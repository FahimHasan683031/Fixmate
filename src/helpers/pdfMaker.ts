import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import ApiError from '../errors/ApiError';
import { StatusCodes } from 'http-status-codes';
import { Payment } from '../app/modules/payment/payment.model';
import { Types } from 'mongoose';

// Types
type PaymentData = {
  service: {
    price: number;
    category: string;
    subcategory: string;
  };
  customer: {
    name: string;
    address: string;
    email: string;
  };
  provider?: {
    name?: string;
  };
  amount: number;
  paymentStatus: string;
  createdAt: string | Date;
  id?: string;
};

export class PDFInvoiceMaker {
  private doc: any;
  private currentY: number;
  private readonly margins = 50;
  private pageWidth: number;
  private headerHeight = 60;

  constructor() {
    this.doc = new PDFDocument({
      size: 'A4',
      margin: this.margins,
    });
    this.currentY = this.margins;
    this.pageWidth = this.doc.page.width - this.margins * 2;
  }

  // Utility functions
  private formatCurrency(amount: number): string {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
    return formatted.replace(/[^0-9.,-]/g, 'R');
  }

  // Replace the currency symbol with "R"

  private formatDate(date: string | Date): string {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private addText(
    text: string,
    options: {
      fontSize?: number;
      bold?: boolean;
      align?: 'left' | 'center' | 'right';
      color?: string;
    } = {}
  ) {
    const {
      fontSize = 12,
      bold = false,
      align = 'left',
      color = '#000000',
    } = options;

    this.doc
      .fontSize(fontSize)
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fillColor(color)
      .text(text, this.margins, this.currentY, {
        align,
        width: this.pageWidth,
      });

    this.currentY += fontSize + 8;
    return this;
  }

  private addSectionHeader(title: string) {
    this.addText(title, { fontSize: 14, bold: true, color: '#2c3e50' });
    this.currentY += 5;
    return this;
  }

  private addHorizontalLine() {
    this.doc
      .moveTo(this.margins, this.currentY)
      .lineTo(this.margins + this.pageWidth, this.currentY)
      .strokeColor('#e0e0e0')
      .lineWidth(1)
      .stroke();

    this.currentY += 15;
    return this;
  }

  private addSpacing(height: number = 10) {
    this.currentY += height;
    return this;
  }

  private drawHeader() {
    const headerY = this.currentY;
    const now = new Date();

    const candidates = [
      path.join(process.cwd(), 'uploads', 'image', 'fixmate-logo.png'),
      path.join(process.cwd(), 'uploads', 'image', 'logo.png'),
      path.join(process.cwd(), 'src', 'assets', 'fixmate-logo.png'),
    ];
    let logoBuffer: Buffer | undefined;
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          logoBuffer = fs.readFileSync(p);
          break;
        }
      } catch { }
    }

    if (logoBuffer) {
      this.doc.image(logoBuffer, this.margins, headerY, { fit: [120, 40] });
    } else {
      this.doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .fillColor('#656cf7ff')
        .text('Fixmate', this.margins, headerY, { width: 200, color: '#4d54e9ff' });
    }

    const generatedText = `Generated: ${this.formatDate(now)}`;
    this.doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#7f8c8d')
      .text(generatedText, this.margins, headerY, {
        align: 'right',
        width: this.pageWidth,
        lineBreak: false,
      });

    this.currentY = headerY + this.headerHeight;
    this.addHorizontalLine();
  }

  // Generate PDF
  public async generatePDFBuffer(data: PaymentData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const chunks: Buffer[] = [];

        // Collect PDF data
        this.doc.on('data', (chunk: any) => chunks.push(chunk));
        this.doc.on('end', () => resolve(Buffer.concat(chunks)));
        this.doc.on('error', reject);

        // Generate PDF content
        this.generatePDFContent(data);

        // Finalize PDF
        this.doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Stream PDF
  public streamPDFToResponse(
    res: Response,
    data: PaymentData,
    filename: string = 'invoice.pdf'
  ): void {
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Pipe PDF directly to response
    this.doc.pipe(res);

    // Generate PDF content
    this.generatePDFContent(data);

    // Finalize PDF
    this.doc.end();
  }

  private generatePDFContent(data: PaymentData) {
    this.drawHeader();
    this.addText('PAYMENT RECEIPT', {
      fontSize: 24,
      bold: true,
      align: 'center',
      color: '#2c3e50',
    });
    this.addSpacing(5);
    this.addText('Thank you for your payment', {
      fontSize: 14,
      align: 'center',
      color: '#7f8c8d',
    });
    this.addSpacing(20);
    this.addHorizontalLine();

    // Service Information Section
    this.addSectionHeader('SERVICE INFORMATION');
    this.addText(`Category: ${data.service.category || 'N/A'}`);
    this.addText(`Subcategory: ${data.service.subcategory || 'N/A'}`);
    this.addText(`Status: ${data.paymentStatus || 'N/A'}`);
    this.addText(`Amount: ${this.formatCurrency(data.service.price)}`);
    this.addSpacing(15);

    // User Information Section
    this.addSectionHeader('USER INFORMATION');
    this.addText(`Name: ${data.customer.name || 'N/A'}`);
    this.addText(`Email: ${data.customer.email || 'N/A'}`);
    this.addText(`Location: ${data.customer.address || 'N/A'}`);
    this.addSpacing(15);

    // Payment Details Section
    this.addSectionHeader('PAYMENT DETAILS');
    const actual = Number(data.amount || 0);
    const appRevenue = actual * 0.1;
    const netToProvider = actual - appRevenue;
    this.addText(`Paid Amount: ${this.formatCurrency(actual)}`);
    this.addText(
      `Application Revenue (10%): ${this.formatCurrency(appRevenue)}`
    );
    this.addText(`Net To Provider: ${this.formatCurrency(netToProvider)}`);
    this.addText(`Date & Time: ${this.formatDate(data.createdAt)}`);
    this.addSpacing(20);

    // Summary Box
    this.drawSummaryBox(data);

    // Footer
    this.addSpacing(30);
    this.addHorizontalLine();
    this.addText('Generated by Fixmate', {
      fontSize: 10,
      align: 'center',
      color: '#2c3e50',
    });
  }

  private drawSummaryBox(data: PaymentData) {
    const boxY = this.currentY;
    const boxHeight = 110;

    // Draw box background
    this.doc
      .rect(this.margins, boxY, this.pageWidth, boxHeight)
      .fill('#f8f9fa')
      .stroke('#dee2e6');

    // Add summary content
    this.doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .fillColor('#2c3e50')
      .text('PAYMENT SUMMARY', this.margins + 20, boxY + 15);

    const actual = Number(data.amount || 0);
    const appRevenue = actual * 0.1;
    const netToProvider = actual - appRevenue;
    this.doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#2c3e50')
      .text('Paid Amount:', this.margins + 20, boxY + 40)
      .font('Helvetica-Bold')
      .text(this.formatCurrency(actual), this.margins + 120, boxY + 40);

    this.doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#2c3e50')
      .text('Application Revenue (10%):', this.margins + 20, boxY + 60)
      .font('Helvetica-Bold')
      .text(this.formatCurrency(appRevenue), this.margins + 200, boxY + 60);

    this.doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#27ae60')
      .text('Net To Provider:', this.margins + 20, boxY + 80)
      .font('Helvetica-Bold')
      .text(this.formatCurrency(netToProvider), this.margins + 150, boxY + 80);

    this.doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#7f8c8d')
      .text(
        `Payment Date: ${this.formatDate(data.createdAt)}`,
        this.margins + 20,
        boxY + 60
      );

    this.currentY += boxHeight + 20;
  }
}



// Send derect responce
export async function generateInvoiceAPI(req: Request, res: Response) {
  try {
    if (!req.params.id)
      throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'You must give the id!');

    const info = await Payment.find({
      _id: new Types.ObjectId(req.params.id),
    }).populate('customer service').select('customer provider service booking amount paymentStatus createdAt whatsApp contact').lean().exec();

    const data = info[0];
    if (!data)
      throw new ApiError(StatusCodes.NOT_FOUND, 'Payment details not found!');

    const paymentData: PaymentData = {
      service: {
        //@ts-ignore
        price: data.service.price || 0, //@ts-ignore
        category: data.service.category || 'N/A', //@ts-ignore
        subcategory: data.service.subcategory || 'N/A',
      },
      customer: {
        //@ts-ignore
        name: data.customer.name || 'N/A', //@ts-ignore
        address: data.customer.address || 'N/A', //@ts-ignore
        email: data.customer.email || 'N/A',
      }, //@ts-ignore
      amount: data.amount || 0, //@ts-ignore
      paymentStatus: data.paymentStatus || 'PENDING', //@ts-ignore
      createdAt: data.createdAt || new Date(), //@ts-ignore
      id: data._id || `inv-${Date.now()}`,
    };

    const pdfMaker = new PDFInvoiceMaker();

    pdfMaker.streamPDFToResponse(
      res,
      paymentData,
      `invoice-${paymentData.id}.pdf`
    );
  } catch (error) {
    console.error('Error generating PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to generate PDF invoice',
      });
    }
  }
}

// export async function generateInvoiceAPIApp(req: Request, res: Response) {
//   try {
//     if (!req.params.id) {
//       throw new ApiError(StatusCodes.NOT_ACCEPTABLE, "You must give the id!");
//     }

//     const info = await userRepo.wallet({
//       filter: { _id: new Types.ObjectId(req.params.id) },
//       populate: ["customer", "service"],
//       select: "customer provider service booking amount paymentStatus createdAt"
//     });

//     const data = info?.[0];
//     if (!data) {
//       throw new ApiError(StatusCodes.NOT_FOUND, "Payment details not found!");
//     }

//     // ---- Build PaymentData object ----
//     const paymentData: PaymentData = {
//       service: {
//         price: data.service?.price ?? 0,
//         category: data.service?.category ?? "N/A",
//         subcategory: data.service?.subcategory ?? "N/A",
//       },
//       customer: {
//         name: data.customer?.name ?? "N/A",
//         address: data.customer?.address ?? "N/A",
//         email: data.customer?.email ?? "N/A",
//       },
//       amount: data.amount ?? 0,
//       paymentStatus: data.paymentStatus ?? "Unknown",
//       createdAt: data.createdAt ?? new Date(),
//       id: data._id?.toString() ?? `inv-${Date.now()}`,
//     };

//     // ---- Generate PDF buffer ----
//     const pdfMaker = new PDFInvoiceMaker();
//     const pdfBuffer = await pdfMaker.generatePDFBuffer(paymentData);

//     // ---- Respond with base64 PDF ----
//     res.json({
//       success: true,
//       data: paymentData,
//       pdf: pdfBuffer.toString("base64"), // 👈 App downloads from this
//       filename: `invoice-${paymentData.id}.pdf`,
//       mime: "application/pdf"
//     });

//   } catch (error) {
//     console.error("Error generating PDF:", error);

//     if (!res.headersSent) {
//       res.status(500).json({
//         success: false,
//         message: "Failed to generate PDF invoice",
//       });
//     }
//   }
// }

// Return as Buffer
export async function generateInvoiceAsBuffer(req: any, res: Response) {
  try {
    const paymentData: PaymentData = {
      service: {
        price: req.body.service?.price || 0,
        category: req.body.service?.category || 'N/A',
        subcategory: req.body.service?.subcategory || 'N/A',
      },
      customer: {
        name: req.body.customer?.name || 'N/A',
        address: req.body.customer?.address || 'N/A',
        email: req.body.customer?.email || 'N/A',
      },
      amount: req.body.amount || 0,
      paymentStatus: req.body.paymentStatus || 'Unknown',
      createdAt: req.body.createdAt || new Date(),
      id: req.body.id || `inv-${Date.now()}`,
    };

    const pdfMaker = new PDFInvoiceMaker();
    const pdfBuffer = await pdfMaker.generatePDFBuffer(paymentData);

    // Set headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoice-${paymentData.id}.pdf"`
    );
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send buffer
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF invoice',
    });
  }
}

// Simple one-function approach
export function streamPaymentPDF(res: Response, data: any) {
  try {
    const paymentData: PaymentData = {
      service: {
        price: data.service?.price || 0,
        category: data.service?.category || 'N/A',
        subcategory: data.service?.subcategory || 'N/A',
      },
      customer: {
        name: data.customer?.name || 'N/A',
        address: data.customer?.address || 'N/A',
        email: data.customer?.email || 'N/A',
      },
      amount: data.amount || 0,
      paymentStatus: data.paymentStatus || 'Unknown',
      createdAt: data.createdAt || new Date(),
      id: data.id || `inv-${Date.now()}`,
    };

    const pdfMaker = new PDFInvoiceMaker();
    pdfMaker.streamPDFToResponse(res, paymentData, 'payment-receipt.pdf');
  } catch (error) {
    console.error('Error generating PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
  }
}

export class PDFMultiInvoiceMaker {
  private doc: any;
  private margins = 50;
  private pageWidth: number;
  private currentY = 50;
  private headerHeight = 60;

  constructor() {
    this.doc = new PDFDocument({
      size: 'A4',
      margin: this.margins,
    });

    this.pageWidth = 595.28 - this.margins * 2; // A4 width
  }

  private drawHeader() {
    const now = new Date();
    const headerY = this.currentY;

    // Try to load Fixmate logo from common locations
    const candidates = [
      path.join(process.cwd(), 'uploads', 'image', 'fixmate-logo.png'),
      path.join(process.cwd(), 'uploads', 'image', 'logo.png'),
      path.join(process.cwd(), 'src', 'assets', 'fixmate-logo.png'),
    ];

    let logoBuffer: Buffer | undefined;
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          logoBuffer = fs.readFileSync(p);
          break;
        }
      } catch { }
    }

    if (logoBuffer) {
      this.doc.image(logoBuffer, this.margins, headerY, { fit: [120, 40] });
    } else {
      this.doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .fillColor('#2c3e50')
        .text('Fixmate', this.margins, headerY, { width: 200 });
    }

    this.doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#7f8c8d')
      .text(`Generated: ${now.toLocaleString()}`, this.margins, headerY, {
        align: 'right',
        width: this.pageWidth,
      });

    this.currentY = headerY + this.headerHeight;
    this.addLine();
  }

  private addText(text: string, options: any = {}) {
    const { fontSize = 12, bold = false, align = 'left' } = options;

    this.doc
      .fontSize(fontSize)
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .text(text, this.margins, this.currentY, {
        width: this.pageWidth,
        align,
      });

    this.currentY += fontSize + 10;
  }

  private addLine() {
    this.doc
      .moveTo(this.margins, this.currentY)
      .lineTo(this.margins + this.pageWidth, this.currentY)
      .strokeColor('#ccc')
      .stroke();

    this.currentY += 15;
  }

  private checkPageBreak() {
    const maxY = this.doc.page.height - this.margins - 5;
    if (this.currentY > maxY) {
      this.doc.addPage();
      this.currentY = this.margins;
    }
  }

  private formatCurrency(amount: number) {
    return 'R' + amount.toFixed(2);
  }

  private formatDate(d: any) {
    return new Date(d).toLocaleString();
  }

  private formatDateShort(d: any) {
    const dt = new Date(d);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    const hh = String(dt.getHours()).padStart(2, '0');
    const mi = String(dt.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  }

  private formatISODate(d: any) {
    const dt = new Date(d);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private formatTimeShort(d: any) {
    const dt = new Date(d);
    const hh = String(dt.getHours()).padStart(2, '0');
    const mi = String(dt.getMinutes()).padStart(2, '0');
    return `${hh}:${mi}`;
  }

  private drawTableHeader() {
    const headers = [
      { title: '#', width: 40 },
      { title: 'Category', width: 70 },
      { title: 'Paid', width: 70 },
      { title: 'App Rev (10%)', width: 80 },
      { title: 'Net', width: 55 },
      { title: 'Date', width: 55 },
      { title: 'Time', width: 35 },
      { title: 'Customer', width: 90 },
    ];

    let x = this.margins;
    const y = this.currentY;

    const headerRowHeight = 36;
    this.doc
      .rect(this.margins, y, this.pageWidth, headerRowHeight)
      .fill('#f0f3f5')
      .stroke('#dfe4ea');
    this.doc.fillColor('#2c3e50').fontSize(11).font('Helvetica-Bold');
    headers.forEach(h => {
      this.doc.text(h.title, x + 6, y + 10, {
        width: h.width - 12,
        lineBreak: false,
      });
      x += h.width;
    });
    this.currentY += headerRowHeight;
  }

  private drawTitle(text: string) {
    this.doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .fillColor('#2c3e50')
      .text(text, this.margins, this.currentY, { width: this.pageWidth });
    this.currentY += 24;
    this.addLine();
  }

  private renderOrderCard(data: PaymentData, index: number, total: number) {
    const actual = Number(data.amount || 0);
    const appRevenue = actual * 0.1;
    const net = actual - appRevenue;

    const colGap = 20;
    const colWidth = (this.pageWidth - colGap) / 2;
    const padding = 16;

    const leftItems = [
      { label: 'Category', value: data.service.category || 'N/A' },
      { label: 'Subcategory', value: data.service.subcategory || 'N/A' },
      { label: 'Customer', value: data.customer.name || 'N/A' },
      { label: 'Provider', value: data.provider?.name || 'N/A' },
    ];
    const rightItems = [
      { label: 'Paid Amount', value: this.formatCurrency(actual) },
      { label: 'App Revenue (10%)', value: this.formatCurrency(appRevenue) },
      { label: 'Net To Provider', value: this.formatCurrency(net) },
    ];

    this.doc.fontSize(10).font('Helvetica');

    const measureBlock = (items: { label: string; value: string }[]) => {
      let total = 0;
      items.forEach(i => {
        const labelH = this.doc.heightOfString(i.label, {
          width: colWidth - padding * 2,
        });
        const valueH = this.doc.heightOfString(i.value, {
          width: colWidth - padding * 2,
        });
        total += labelH + 12 + valueH + 6;
      });
      return total;
    };

    const leftBlockHeight = measureBlock(leftItems);
    const rightBlockHeight = measureBlock(rightItems);
    const addressHeight = this.doc.heightOfString(
      data.customer.address || 'N/A',
      { width: this.pageWidth - padding * 2 }
    );

    const baseCardHeight = 160;
    const computedHeight =
      Math.max(leftBlockHeight, rightBlockHeight) +
      addressHeight +
      70 +
      padding * 2;
    const cardHeight = Math.max(baseCardHeight, computedHeight);

    const maxY = this.doc.page.height - this.margins - 5;
    if (this.currentY + cardHeight > maxY) {
      this.doc.addPage();
      this.currentY = this.margins;
      this.drawHeader();
    }

    // Calculate cardY and contentTop AFTER potential page break to use updated currentY
    const cardY = this.currentY;
    const contentTop = cardY + padding + 20;

    this.doc
      .rect(this.margins, cardY, this.pageWidth, cardHeight)
      .fill('#f8f9fa')
      .stroke('#dfe4ea');
    this.doc
      .fillColor('#2c3e50')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(
        `Order ${index + 1} of ${total}`,
        this.margins + padding,
        cardY + padding
      );

    this.doc.fillColor('#7f8c8d').fontSize(9).font('Helvetica');
    let ly = contentTop;
    leftItems.forEach(i => {
      this.doc
        .font('Helvetica-Bold')
        .fillColor('#2c3e50')
        .text(i.label, this.margins + padding, ly, {
          width: colWidth - padding * 2,
        });
      ly += 12;
      this.doc
        .font('Helvetica')
        .fillColor('#2c3e50')
        .text(i.value, this.margins + padding, ly, {
          width: colWidth - padding * 2,
        });
      ly += 18;
    });

    let ry = contentTop;
    rightItems.forEach(i => {
      this.doc
        .font('Helvetica-Bold')
        .fillColor('#2c3e50')
        .text(i.label, this.margins + padding + colWidth + colGap, ry, {
          width: colWidth - padding * 2,
        });
      ry += 12;
      this.doc
        .font('Helvetica')
        .fillColor('#2c3e50')
        .text(i.value, this.margins + padding + colWidth + colGap, ry, {
          width: colWidth - padding * 2,
        });
      ry += 18;
    });

    const bottomY = Math.max(ly, ry) + 10;
    this.doc
      .font('Helvetica-Bold')
      .fillColor('#2c3e50')
      .text('Address', this.margins + padding, bottomY, {
        width: this.pageWidth - padding * 2,
      });
    this.doc
      .font('Helvetica')
      .fillColor('#2c3e50')
      .text(
        data.customer.address || 'N/A',
        this.margins + padding,
        bottomY + 12,
        { width: this.pageWidth - padding * 2 }
      );

    const dateTimeY =
      bottomY +
      12 +
      this.doc.heightOfString(data.customer.address || 'N/A', {
        width: this.pageWidth - padding * 2,
      }) +
      10;
    this.doc
      .font('Helvetica-Bold')
      .fillColor('#2c3e50')
      .text('Date & Time', this.margins + padding, dateTimeY, {
        width: this.pageWidth - padding * 2,
      });
    this.doc
      .font('Helvetica')
      .fillColor('#2c3e50')
      .text(
        this.formatISODate(data.createdAt),
        this.margins + padding,
        dateTimeY + 12,
        { width: this.pageWidth - padding * 2 }
      );
    this.doc
      .font('Helvetica')
      .fillColor('#2c3e50')
      .text(
        this.formatTimeShort(data.createdAt),
        this.margins + padding,
        dateTimeY + 24,
        { width: this.pageWidth - padding * 2 }
      );

    this.currentY = cardY + cardHeight + 20;
  }

  private drawTableRow(data: PaymentData, index: number) {
    const actual = Number(data.amount || 0);
    const appRevenue = actual * 0.1;
    const net = actual - appRevenue;

    const cols = [
      { text: String(index + 1), width: 40 },
      { text: data.service.category || 'N/A', width: 70 },
      { text: this.formatCurrency(actual), width: 70 },
      { text: this.formatCurrency(appRevenue), width: 80 },
      { text: this.formatCurrency(net), width: 55 },
      { text: this.formatISODate(data.createdAt), width: 55 },
      { text: this.formatTimeShort(data.createdAt), width: 35 },
      { text: data.customer.name || 'N/A', width: 90 },
    ];

    // calculate dynamic row height up to two lines
    this.doc.fillColor('#2c3e50').fontSize(10).font('Helvetica');
    const contentHeights = cols.map(c =>
      this.doc.heightOfString(c.text, { width: c.width - 12 })
    );
    const baseHeight = 26;
    const maxHeight = Math.max(...contentHeights) + 10;
    const rowHeight = Math.min(Math.max(baseHeight, maxHeight), 48);

    if (this.currentY + rowHeight > 780) {
      this.doc.addPage();
      this.currentY = this.margins;
      this.drawHeader();
      this.drawTableHeader();
    }

    let x = this.margins;
    const y = this.currentY;
    this.doc.rect(this.margins, y, this.pageWidth, rowHeight).stroke('#eaeaea');
    this.doc.fillColor('#2c3e50').fontSize(10).font('Helvetica');
    cols.forEach(c => {
      const contentWidth = c.width - 12;
      this.doc.text(c.text, x + 6, y + 5, { width: contentWidth });
      x += c.width;
    });
    this.currentY += rowHeight;
  }

  public async generateMultiPDF(orders: PaymentData[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      this.doc.on('data', (c: any) => chunks.push(c));
      this.doc.on('end', () => resolve(Buffer.concat(chunks)));
      this.doc.on('error', reject);

      this.drawHeader();
      this.drawTitle('Combined Invoices');

      // Render all orders first
      orders.forEach((order, idx) =>
        this.renderOrderCard(order, idx, orders.length)
      );

      // Add summary statistics
      this.addSummaryStatistics(orders);

      this.doc.end();
    });
  }

  //new 👍👍👍
  private addSummaryStatistics(orders: PaymentData[]) {
    // Calculate statistics
    const totalBookings = orders.length;
    let totalAmountPaid = 0;
    let totalAppRevenue = 0;
    let totalProviderNet = 0;

    orders.forEach(order => {
      const amount = Number(order.amount || 0);
      const appRevenue = amount * 0.1;
      const providerNet = amount - appRevenue;

      totalAmountPaid += amount;
      totalAppRevenue += appRevenue;
      totalProviderNet += providerNet;
    });

    // Check if we need a new page for the summary
    this.checkPageBreak();

    // Add a separator before the summary
    // this.doc
    //   .moveTo(this.margins, this.currentY)
    //   .lineTo(this.margins + this.pageWidth, this.currentY)
    //   .strokeColor('#2c3e50')
    //   .lineWidth(0.5)
    //   .stroke();

    this.currentY += 40;

    // Add summary title
    this.doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#2c3e50')
      .text('Summary Statistics', this.margins, this.currentY);

    this.currentY += 25;

    // Create a summary box
    const summaryBoxHeight = 120;
    const summaryBoxY = this.currentY;

    // Draw summary box with background
    this.doc
      .rect(this.margins, summaryBoxY, this.pageWidth, summaryBoxHeight)
      .fill('#f8f9fa')
      .stroke('#dfe4ea');

    // Calculate column positions
    const colWidth = this.pageWidth / 2;
    const leftX = this.margins + 30;
    const rightX = this.margins + colWidth + 10;
    const rowHeight = 25;

    // Add statistics - Left column
    let currentRowY = summaryBoxY + 20;

    this.addSummaryRow(
      'Total Bookings:',
      totalBookings.toString(),
      leftX,
      currentRowY
    );
    currentRowY += rowHeight;

    this.addSummaryRow(
      'Total Amount Paid:',
      this.formatCurrency(totalAmountPaid),
      leftX,
      currentRowY
    );
    currentRowY += rowHeight;

    // Add statistics - Right column
    currentRowY = summaryBoxY + 20;

    this.addSummaryRow(
      'App Revenue (10%):',
      this.formatCurrency(totalAppRevenue),
      rightX,
      currentRowY
    );
    currentRowY += rowHeight;

    this.addSummaryRow(
      'Paid to Providers:',
      this.formatCurrency(totalProviderNet),
      rightX,
      currentRowY
    );

    this.currentY = summaryBoxY + summaryBoxHeight + 20;

    // Optional: Add a grand total row
    this.doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#27ae60')
      .text(
        'Grand Total Amount: ' + this.formatCurrency(totalAmountPaid),
        this.margins,
        this.currentY,
        { align: 'right', width: this.pageWidth }
      );

    this.currentY += 20;
  }

  private addSummaryRow(label: string, value: string, x: number, y: number) {
    this.doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#2c3e50')
      .text(label, x, y, { width: 150 });

    this.doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#2c3e50')
      .text(value, x + 150, y, { width: 100 });
  }

  public streamMultiPDFToResponse(
    res: Response,
    orders: PaymentData[],
    filename: string = 'combined-invoices.pdf'
  ) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    this.doc.pipe(res);

    this.drawHeader();
    // this.drawTitle('Combined Invoices');

    // Add summary statistics
    this.addSummaryStatistics(orders);
    this.currentY += 40;

    // Render all orders first
    orders.forEach((order, idx) =>
      this.renderOrderCard(order, idx, orders.length)

    );

    this.doc.end();
  }
}
