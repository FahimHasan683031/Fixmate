import { Request } from 'express';
import fs from 'fs';
import { StatusCodes } from 'http-status-codes';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import ApiError from '../../errors/ApiError';

const fileUploadHandler = () => {

    //create upload folder
    const baseUploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(baseUploadDir)) {
        fs.mkdirSync(baseUploadDir);
    }

    //folder create for different file
    const createDir = (dirPath: string) => {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath);
        }
    };

    //create filename
    const storage = multer.diskStorage({

        destination: (req, file, cb) => {
            let uploadDir;
            type IFolderName = 'image' | 'media' | 'resume' | 'companyLogo' | 'nidFront' | 'nidBack' | 'license';
            switch (file.fieldname as IFolderName) {
                case 'image':
                    uploadDir = path.join(baseUploadDir, 'image');
                    break;
                case 'media':
                    uploadDir = path.join(baseUploadDir, 'media');
                    break;
                case 'resume':
                    uploadDir = path.join(baseUploadDir, 'resume');
                    break;
                case 'companyLogo':
                    uploadDir = path.join(baseUploadDir, 'companyLogo');
                    break;
                case 'nidFront':
                    uploadDir = path.join(baseUploadDir, 'nidFront');
                    break;
                case 'nidBack':
                    uploadDir = path.join(baseUploadDir, 'nidBack');
                    break;
                case 'license':
                    uploadDir = path.join(baseUploadDir, 'license');
                    break;
                default:
                    throw new ApiError(StatusCodes.BAD_REQUEST, 'File is not supported');
            }
            createDir(uploadDir);
            cb(null, uploadDir);
        },

        filename: (req, file, cb) => {
            const fileExt = path.extname(file.originalname);
            const fileName =
                file.originalname
                    .replace(fileExt, '')
                    .toLowerCase()
                    .split(' ')
                    .join('-') +
                '-' +
                Date.now();
            cb(null, fileName + fileExt);
        },
    });

    //file filter
    const filterFilter = (req: Request, file: any, cb: FileFilterCallback) => {

        // console.log("file handler",file)
        if (file.fieldname === 'image') {
            if (
                file.mimetype === 'image/jpeg' ||
                file.mimetype === 'image/png' ||
                file.mimetype === 'image/jpg'
            ) {
                cb(null, true);
            } else {
                cb(new ApiError(StatusCodes.BAD_REQUEST, 'Only .jpeg, .png, .jpg file supported'))
            }
        } else if (file.fieldname === 'media') {
            if (
                file.mimetype === 'image/jpeg' ||
                file.mimetype === 'image/png' ||
                file.mimetype === 'image/jpg'
            ) {
                cb(null, true);
            } else {
                cb(new ApiError(StatusCodes.BAD_REQUEST, 'Only .png file supported'))
            }
        }

        else if (file.fieldname === 'nidFront' || file.fieldname === 'nidBack' || file.fieldname === 'license') {
            if (
                file.mimetype === 'image/jpeg' ||
                file.mimetype === 'image/png' ||
                file.mimetype === 'image/jpg'
            ) {
                cb(null, true);
            } else {
                cb(new ApiError(StatusCodes.BAD_REQUEST, 'Only .jpeg, .png, .jpg file supported'))
            }
        }
        else {
            cb(new ApiError(StatusCodes.BAD_REQUEST, 'This file is not supported'))
        }
    };

    const upload = multer({ storage: storage, fileFilter: filterFilter })
        .fields([
            { name: 'image', maxCount: 3 },
            { name: 'media', maxCount: 2 },
            { name: 'nidFront', maxCount: 1 },
            { name: 'nidBack', maxCount: 1 },
            { name: 'license', maxCount: 1 },
        ]);
    return upload;

};

export default fileUploadHandler;
