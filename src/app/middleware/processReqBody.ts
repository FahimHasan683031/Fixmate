import { Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

type IFolderName =
  | 'image'
  | 'media'
  | 'documents'
  | 'nid'
  | 'license'
  | 'nidFront'
  | 'nidBack'
  | 'other'
  | 'evidence';

interface ProcessedFiles {
  [key: string]: string | string[] | undefined;
}

const uploadFields = [
  { name: 'image', maxCount: 1 },
  { name: 'media', maxCount: 3 },
  { name: 'documents', maxCount: 3 },
  { name: 'nid', maxCount: 1 },
  { name: 'license', maxCount: 1 },
  { name: 'nidFront', maxCount: 1 },
  { name: 'nidBack', maxCount: 1 },
  { name: 'other', maxCount: 5 },
  { name: 'evidence', maxCount: 5 },
] as const;

// Helper to deeply parse JSON-stringified nested objects
const deepParseJson = (data: any): any => {
  if (typeof data === 'string') {
    try {
      if ((data.startsWith('{') && data.endsWith('}')) || (data.startsWith('[') && data.endsWith(']'))) {
        return deepParseJson(JSON.parse(data));
      }
    } catch (error) {
      // ignore
    }
  } else if (Array.isArray(data)) {
    return data.map(item => deepParseJson(item));
  } else if (data !== null && typeof data === 'object') {
    const result: any = {};
    for (const key in data) {
      result[key] = deepParseJson(data[key]);
    }
    return result;
  }
  return data;
};

export const fileAndBodyProcessorUsingDiskStorage = () => {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (_req, file, cb) => {
      const folderPath = path.join(uploadsDir, file.fieldname);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      cb(null, folderPath);
    },
    filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname) || `.${file.mimetype.split('/')[1]}`;
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`;
      cb(null, filename);
    },
  });

  const fileFilter = (_req: Request, _file: Express.Multer.File, cb: FileFilterCallback) => {
    cb(null, true);
  };

  const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024, files: 50 },
  }).fields(uploadFields);

  return (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, async error => {
      if (error) return next(error);

      try {
        if (req.body?.data) {
          req.body = deepParseJson(JSON.parse(req.body.data));
        } else {
          req.body = deepParseJson(req.body);
        }

        if (!req.files) {
          return next();
        }

        const processedFiles: ProcessedFiles = {};
        const fieldsConfig = new Map(uploadFields.map(f => [f.name, f.maxCount]));

        await Promise.all(
          Object.entries(req.files).map(async ([fieldName, files]) => {
            const fileArray = files as Express.Multer.File[];
            const maxCount = fieldsConfig.get(fieldName as IFolderName) ?? 1;
            const paths: string[] = [];

            await Promise.all(
              fileArray.map(async file => {
                const filePath = `/${fieldName}/${file.filename}`;
                paths.push(filePath);

                if (
                  ['image', 'nid', 'license', 'nidFront', 'nidBack', 'other', 'evidence'].includes(fieldName) &&
                  file.mimetype.startsWith('image/')
                ) {
                  const fullPath = path.join(uploadsDir, fieldName, file.filename);
                  const tempPath = fullPath + '.opt';

                  try {
                    let sharpInstance = sharp(fullPath)
                      .rotate()
                      .resize(800, null, { withoutEnlargement: true });

                    if (file.mimetype === 'image/png') {
                      sharpInstance = sharpInstance.png({ quality: 80 });
                    } else {
                      sharpInstance = sharpInstance.jpeg({
                        quality: 80,
                        mozjpeg: true,
                      });
                    }

                    await sharpInstance.toFile(tempPath);
                    fs.unlinkSync(fullPath);
                    fs.renameSync(tempPath, fullPath);
                  } catch (err) {
                    console.error(`Failed to optimize ${filePath}:`, err);
                  }
                }
              }),
            );

            processedFiles[fieldName] = maxCount > 1 ? paths : paths[0];
          }),
        );

        req.body = {
          ...req.body,
          ...processedFiles,
        };

        next();
      } catch (err) {
        next(err);
      }
    });
  };
};
