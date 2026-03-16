import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import ApiError from '../errors/ApiError';
import { StatusCodes } from 'http-status-codes';
import { Payment } from '../app/modules/payment/payment.model';
import { Types } from 'mongoose';
import axios from 'axios';

// Types
type PaymentData = {
  service: {
    price: number;
    category: string;
    subCategory: string;
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
  platformFee: number;
  gatewayFee: number;
  providerAmount: number;
  paymentStatus: string;
  createdAt: string | Date;
  id?: string;
};

export class PDFInvoiceMaker {
  private doc: any;
  private currentY: number;
  private readonly margins = 50;
  private pageWidth: number;
  private headerHeight = 90;

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

  private async drawHeader() {
    const headerY = this.currentY;
    const now = new Date();
    const logoUrl = "https://i.ibb.co.com/Lzs2kqSn/Image20260314205009.png";

    try {
      const response = await axios.get(logoUrl, { responseType: 'arraybuffer' });
      const logoBuffer = Buffer.from(response.data);
      this.doc.image(logoBuffer, this.margins, headerY - 15, { fit: [200, 80] });
    } catch (error) {
      console.error("Failed to fetch logo, using text fallback:", error);
      this.doc
        .fontSize(24)
        .font('Helvetica-Bold')
        .fillColor('#0062EB')
        .text('Fixmate', this.margins, headerY);
    }

    const generatedText = `Generated: ${this.formatDate(now)}`;
    this.doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#7f8c8d')
      .text(generatedText, this.margins, headerY + 15, {
        align: 'right',
        width: this.pageWidth,
      });

    this.currentY = headerY + this.headerHeight + 10;
    this.addHorizontalLine();
  }

  // Generate PDF
  public async generatePDFBuffer(data: PaymentData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const chunks: Buffer[] = [];

        // Collect PDF data
        this.doc.on('data', (chunk: any) => chunks.push(chunk));
        this.doc.on('end', () => resolve(Buffer.concat(chunks)));
        this.doc.on('error', reject);

        // Generate PDF content
        await this.generatePDFContent(data);

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

    // Generate PDF content (must be awaited if it interacts with async headers)
    this.generatePDFContent(data).then(() => {
      this.doc.end();
    });
  }

  private async generatePDFContent(data: PaymentData) {
    await this.drawHeader();
    this.addText('PAYMENT RECEIPT', {
      fontSize: 22,
      bold: true,
      align: 'center',
      color: '#0062EB',
    });
    this.addSpacing(2);
    this.addText('Thank you for choosing Fixmate', {
      fontSize: 12,
      align: 'center',
      color: '#7f8c8d',
    });
    this.addSpacing(15);
    this.addHorizontalLine();

    // Two column layout for info
    const leftColX = this.margins;
    const rightColX = this.margins + (this.pageWidth / 2);
    const startY = this.currentY;

    // Service Information (Left)
    this.doc.fontSize(14).font('Helvetica-Bold').fillColor('#0062EB').text('SERVICE INFORMATION', leftColX, startY);
    this.doc.fontSize(12).font('Helvetica').fillColor('#2c3e50');
    this.doc.text(`Category: ${data.service.category || 'N/A'}`, leftColX, startY + 25);
    this.doc.text(`Sub Category: ${data.service.subCategory || 'N/A'}`, leftColX, startY + 50);
    this.doc.text(`Booking Status: ${data.paymentStatus || 'N/A'}`, leftColX, startY + 75);

    // User Information (Right)
    this.doc.fontSize(14).font('Helvetica-Bold').fillColor('#0062EB').text('CUSTOMER INFORMATION', rightColX, startY);
    this.doc.fontSize(12).font('Helvetica').fillColor('#2c3e50');
    this.doc.text(`Name: ${data.customer.name || 'N/A'}`, rightColX, startY + 25);
    this.doc.text(`Email: ${data.customer.email || 'N/A'}`, rightColX, startY + 50);
    this.doc.text(`Address: ${data.customer.address || 'N/A'}`, rightColX, startY + 75, { width: this.pageWidth / 2 - 20 });

    this.currentY = startY + 115;
    this.addSpacing(15);
    this.addHorizontalLine();

    // Payment breakdown
    this.addSectionHeader('PAYMENT BREAKDOWN');

    const rowY = this.currentY;
    const col1 = leftColX;
    const col2 = rightColX;

    const addBreakdownRow = (label: string, value: string, y: number, isTotal = false) => {
      this.doc.fontSize(12).font(isTotal ? 'Helvetica-Bold' : 'Helvetica').fillColor('#2c3e50').text(label, col1, y);
      this.doc.fontSize(12).font(isTotal ? 'Helvetica-Bold' : 'Helvetica').fillColor('#2c3e50').text(value, col2, y, { align: 'right', width: this.pageWidth / 2 });
    };

    addBreakdownRow('Total Service Price', this.formatCurrency(data.amount), rowY);
    addBreakdownRow('Fixmate Commission (18%)', this.formatCurrency(data.platformFee || (data.amount * 0.18)), rowY + 28);
    addBreakdownRow('Payment Gateway Cost (3%)', this.formatCurrency(data.gatewayFee || (data.amount * 0.03)), rowY + 56);
    this.addSpacing(85);
    this.addHorizontalLine();

    this.doc.fontSize(16).font('Helvetica-Bold').fillColor('#27ae60').text('Net Provider Earnings', leftColX, this.currentY);
    this.doc.fontSize(16).font('Helvetica-Bold').fillColor('#27ae60').text(this.formatCurrency(data.providerAmount || (data.amount * 0.82)), rightColX, this.currentY, { align: 'right', width: this.pageWidth / 2 });

    this.currentY += 30;
    this.addText(`Payment Date: ${this.formatDate(data.createdAt)}`, { fontSize: 9, color: '#7f8c8d', align: 'right' });

    // Footer
    this.currentY = this.doc.page.height - this.margins - 30;
    this.addHorizontalLine();
    this.addText('Fixmate - Quality Services at Your Fingertips', {
      fontSize: 10,
      align: 'center',
      color: '#0062EB',
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
    }).populate('customer service').select('customer provider service booking amount paymentStatus createdAt whatsApp contact platformFee gatewayFee providerAmount').lean().exec();


    const data = info[0];
    if (!data)
      throw new ApiError(StatusCodes.NOT_FOUND, 'Payment details not found!');

    const paymentData: PaymentData = {
      service: {
        //@ts-ignore
        price: data.service?.price || 0, //@ts-ignore
        category: data.service?.category || 'N/A', //@ts-ignore
        subCategory: data.service?.subCategory || 'N/A',
      },
      customer: {
        //@ts-ignore
        name: data.customer?.name || 'N/A', //@ts-ignore
        address: data.customer?.address || 'N/A', //@ts-ignore
        email: data.customer?.email || 'N/A',
      }, //@ts-ignore
      amount: data.amount || 0,
      platformFee: data.platformFee || 0,
      gatewayFee: data.gatewayFee || 0,
      providerAmount: data.providerAmount || (data.amount - (data.platformFee || 0)),
      paymentStatus: data.paymentStatus || 'PENDING',
      createdAt: data.createdAt || new Date(),
      id: data._id?.toString() || `inv-${Date.now()}`,
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
        subCategory: req.body.service?.subCategory || 'N/A',
      },
      customer: {
        name: req.body.customer?.name || 'N/A',
        address: req.body.customer?.address || 'N/A',
        email: req.body.customer?.email || 'N/A',
      },
      amount: req.body.amount || 0,
      platformFee: req.body.platformFee || 0,
      gatewayFee: req.body.gatewayFee || 0,
      providerAmount: req.body.providerAmount || 0,
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
        subCategory: data.service?.subCategory || 'N/A',
      },
      customer: {
        name: data.customer?.name || 'N/A',
        address: data.customer?.address || 'N/A',
        email: data.customer?.email || 'N/A',
      },
      amount: data.amount || 0,
      platformFee: data.platformFee || 0,
      gatewayFee: data.gatewayFee || 0,
      providerAmount: data.providerAmount || 0,
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
  private headerHeight = 90;

  constructor() {
    this.doc = new PDFDocument({
      size: 'A4',
      margin: this.margins,
    });

    this.pageWidth = 595.28 - this.margins * 2; // A4 width
  }

  private async drawHeader() {
    const now = new Date();
    const headerY = this.currentY;
    const logoUrl = "https://i.ibb.co.com/Lzs2kqSn/Image20260314205009.png";

    try {
      const response = await axios.get(logoUrl, { responseType: 'arraybuffer' });
      const logoBuffer = Buffer.from(response.data);
      this.doc.image(logoBuffer, this.margins, headerY - 15, { fit: [200, 80] });
    } catch (error) {
      this.doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .fillColor('#0062EB')
        .text('Fixmate', this.margins, headerY);
    }

    this.doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#7f8c8d')
      .text(`Generated: ${now.toLocaleString()}`, this.margins, headerY + 15, {
        align: 'right',
        width: this.pageWidth,
      });

    this.currentY = headerY + this.headerHeight + 10;
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
    this.doc.fillColor('#2c3e50').fontSize(12).font('Helvetica-Bold');
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

  private async renderOrderCard(data: PaymentData, index: number, total: number) {
    const actual = Number(data.amount || 0);
    const appRevenue = actual * 0.1;
    const net = actual - appRevenue;

    const colGap = 20;
    const colWidth = (this.pageWidth - colGap) / 2;
    const padding = 16;

    const leftItems = [
      { label: 'Category', value: data.service.category || 'N/A' },
      { label: 'Sub Category', value: data.service.subCategory || 'N/A' },
      { label: 'Customer', value: data.customer.name || 'N/A' },
      { label: 'Provider', value: data.provider?.name || 'N/A' },
    ];
    const rightItems = [
      { label: 'Total Price', value: this.formatCurrency(actual) },
      { label: 'Commission (18%)', value: this.formatCurrency(data.platformFee || (actual * 0.18)) },
      { label: 'Gateway Fee (3%)', value: this.formatCurrency(data.gatewayFee || (actual * 0.03)) },
      { label: 'Provider Net', value: this.formatCurrency(data.providerAmount || (actual * 0.82)) },
    ];
    this.doc.fontSize(12).font('Helvetica');

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
      await this.drawHeader();
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

    this.doc.fillColor('#7f8c8d').fontSize(11).font('Helvetica');
    let ly = contentTop;
    leftItems.forEach(i => {
      this.doc
        .text(i.label, this.margins + padding, ly, {
          width: colWidth - padding * 2,
        });
      ly += 16;
      this.doc
        .font('Helvetica')
        .fillColor('#2c3e50')
        .text(i.value, this.margins + padding, ly, {
          width: colWidth - padding * 2,
        });
      ly += 26;
    });

    let ry = contentTop;
    rightItems.forEach(i => {
      this.doc
        .font('Helvetica-Bold')
        .fillColor('#2c3e50')
        .text(i.label, this.margins + padding + colWidth + colGap, ry, {
          width: colWidth - padding * 2,
        });
      ry += 16;
      this.doc
        .font('Helvetica')
        .fillColor('#2c3e50')
        .text(i.value, this.margins + padding + colWidth + colGap, ry, {
          width: colWidth - padding * 2,
        });
      ry += 26;
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

  private async drawTableRow(data: PaymentData, index: number) {
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
      await this.drawHeader();
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

      (async () => {
        try {
          await this.drawHeader();
          this.drawTitle('Combined Invoices');

          // Render all orders first
          for (let i = 0; i < orders.length; i++) {
            await this.renderOrderCard(orders[i], i, orders.length);
          }

          // Add summary statistics
          this.addSummaryStatistics(orders);

          this.doc.end();
        } catch (e) {
          reject(e);
        }
      })();
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
      .fontSize(14)
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
      .fontSize(13)
      .font('Helvetica-Bold')
      .fillColor('#2c3e50')
      .text(label, x, y, { width: 150 });

    this.doc
      .fontSize(13)
      .font('Helvetica')
      .fillColor('#2c3e50')
      .text(value, x + 150, y, { width: 100 });
  }

  public async streamMultiPDFToResponse(
    res: Response,
    orders: PaymentData[],
    filename: string = 'combined-invoices.pdf'
  ) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    this.doc.pipe(res);

    await this.drawHeader();
    // this.drawTitle('Combined Invoices');

    // Add summary statistics
    this.addSummaryStatistics(orders);
    this.currentY += 40;

    // Render all orders first
    const renderAll = async () => {
      for (let i = 0; i < orders.length; i++) {
        await this.renderOrderCard(orders[i], i, orders.length);
      }
      this.doc.end();
    };

    await renderAll();
  }
}
