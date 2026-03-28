import PDFDocument from 'pdfkit';
import { Request, Response } from 'express';
import ApiError from '../errors/ApiError';
import { StatusCodes } from 'http-status-codes';
import { Payment } from '../app/modules/payment/payment.model';
import { Types } from 'mongoose';
import axios from 'axios';

type PaymentData = {
  customId?: string;
  paymentType: string;
  paymentStatus: string;
  createdAt: string | Date;

  // Base Relations
  customer?: { name: string; address: string; email: string };
  provider?: { name: string; email?: string; address?: string };
  service?: { price: number; category: string; subCategory: string };

  // SERVICE_PAYMENT fields
  amount?: number;
  platformFee?: number;
  gatewayFee?: number;
  providerAmount?: number;

  // CANCELLATION_REFUND / DISPUTE_REFUND fields
  originalAmount?: number;
  penaltyFee?: number;
  refundedAmount?: number;
  providerDeduction?: number;
  cancellationReason?: string;
  disputeReason?: string;

  // WITHDRAWAL fields
  withdrawAmount?: number;
  withdrawalFee?: number;
  netPayout?: number;

  // SETTLEMENT fields
  settledAmount?: number;
  settlementType?: string;
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

  private formatCurrency(amount: number): string {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
    return formatted.replace(/[^0-9.,-]/g, 'R');
  }

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
    } = {},
  ) {
    const { fontSize = 12, bold = false, align = 'left', color = '#000000' } = options;

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
    const logoUrl = 'https://i.ibb.co.com/Lzs2kqSn/Image20260314205009.png';

    try {
      const response = await axios.get(logoUrl, { responseType: 'arraybuffer' });
      const logoBuffer = Buffer.from(response.data);
      this.doc.image(logoBuffer, this.margins, headerY - 15, { fit: [200, 80] });
    } catch (error) {
      console.error('Failed to fetch logo, using text fallback:', error);
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

  public async generatePDFBuffer(data: PaymentData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const chunks: Buffer[] = [];
        this.doc.on('data', (chunk: any) => chunks.push(chunk));
        this.doc.on('end', () => resolve(Buffer.concat(chunks)));
        this.doc.on('error', reject);
        await this.generatePDFContent(data);
        this.doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  public streamPDFToResponse(
    res: Response,
    data: PaymentData,
    filename: string = 'invoice.pdf',
  ): void {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    this.doc.pipe(res);
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

    const leftColX = this.margins;
    const rightColX = this.margins + this.pageWidth / 2;
    const startY = this.currentY;

    this.doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#0062EB')
      .text('PAYMENT INFORMATION', leftColX, startY);
    this.doc.fontSize(12).font('Helvetica').fillColor('#2c3e50');
    this.doc.text(`Invoice ID: ${data.customId || 'N/A'}`, leftColX, startY + 25);
    this.doc.text(`Payment Type: ${data.paymentType || 'N/A'}`, leftColX, startY + 50);
    this.doc.text(`Status: ${data.paymentStatus || 'N/A'}`, leftColX, startY + 75);

    if (data.customer) {
      this.doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#0062EB')
        .text('CUSTOMER INFORMATION', rightColX, startY);
      this.doc.fontSize(12).font('Helvetica').fillColor('#2c3e50');
      this.doc.text(`Name: ${data.customer.name || 'N/A'}`, rightColX, startY + 25);
      this.doc.text(`Email: ${data.customer.email || 'N/A'}`, rightColX, startY + 50);
      this.doc.text(`Address: ${data.customer.address || 'N/A'}`, rightColX, startY + 75, {
        width: this.pageWidth / 2 - 20,
      });
    } else if (data.provider) {
      this.doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#0062EB')
        .text('PROVIDER INFORMATION', rightColX, startY);
      this.doc.fontSize(12).font('Helvetica').fillColor('#2c3e50');
      this.doc.text(`Name: ${data.provider.name || 'N/A'}`, rightColX, startY + 25);
      this.doc.text(`Email: ${data.provider.email || 'N/A'}`, rightColX, startY + 50);
    }

    this.currentY = startY + 115;
    this.addSpacing(15);
    this.addHorizontalLine();

    this.addSectionHeader('PAYMENT BREAKDOWN');

    const rowY = this.currentY;
    const col1 = leftColX;
    const col2 = rightColX;

    const addBreakdownRow = (label: string, value: string, y: number, isTotal = false) => {
      this.doc
        .fontSize(12)
        .font(isTotal ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor('#2c3e50')
        .text(label, col1, y);
      this.doc
        .fontSize(12)
        .font(isTotal ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor('#2c3e50')
        .text(value, col2, y, { align: 'right', width: this.pageWidth / 2 });
    };

    let nextY = rowY;

    // Render properties based on the polymorphic Payment Type
    if (data.paymentType === 'SERVICE_PAYMENT') {
      addBreakdownRow('Total Service Price', this.formatCurrency(data.amount || 0), nextY);
      nextY += 28;
      addBreakdownRow(
        'Fixmate Commission (18%)',
        this.formatCurrency(data.platformFee || 0),
        nextY,
      );
      nextY += 28;
      addBreakdownRow(
        'Payment Gateway Cost (3%)',
        this.formatCurrency(data.gatewayFee || 0),
        nextY,
      );
      nextY += 28;

      this.addSpacing(nextY - this.currentY + 15);
      this.addHorizontalLine();
      this.doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#27ae60')
        .text('Net Provider Earnings', leftColX, this.currentY);
      this.doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#27ae60')
        .text(this.formatCurrency(data.providerAmount || 0), rightColX, this.currentY, {
          align: 'right',
          width: this.pageWidth / 2,
        });
      this.currentY += 30;
    } else if (data.paymentType === 'CANCELLATION_REFUND') {
      addBreakdownRow(
        'Original Service Price',
        this.formatCurrency(data.originalAmount || 0),
        nextY,
      );
      nextY += 28;
      addBreakdownRow(
        'Cancellation Penalty Deducted',
        this.formatCurrency(data.penaltyFee || 0),
        nextY,
      );
      nextY += 28;
      if (data.providerDeduction) {
        addBreakdownRow(
          'Provider Penalty Fine',
          this.formatCurrency(data.providerDeduction),
          nextY,
        );
        nextY += 28;
      }
      if (data.cancellationReason) {
        this.doc
          .fontSize(10)
          .font('Helvetica-Oblique')
          .fillColor('#e74c3c')
          .text(`Reason: ${data.cancellationReason}`, leftColX, nextY);
        nextY += 28;
      }
      this.addSpacing(nextY - this.currentY + 15);
      this.addHorizontalLine();
      this.doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#27ae60')
        .text('Net Refunded Amount', leftColX, this.currentY);
      this.doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#27ae60')
        .text(this.formatCurrency(data.refundedAmount || 0), rightColX, this.currentY, {
          align: 'right',
          width: this.pageWidth / 2,
        });
      this.currentY += 30;
    } else if (data.paymentType === 'WITHDRAWAL') {
      addBreakdownRow(
        'Total Withdrawal Request',
        this.formatCurrency(data.withdrawAmount || 0),
        nextY,
      );
      nextY += 28;
      addBreakdownRow(
        'Withdrawal Processing Fee',
        this.formatCurrency(data.withdrawalFee || 0),
        nextY,
      );
      nextY += 28;
      this.addSpacing(nextY - this.currentY + 15);
      this.addHorizontalLine();
      this.doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#27ae60')
        .text('Net Bank Payout', leftColX, this.currentY);
      this.doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#27ae60')
        .text(this.formatCurrency(data.netPayout || 0), rightColX, this.currentY, {
          align: 'right',
          width: this.pageWidth / 2,
        });
      this.currentY += 30;
    } else if (data.paymentType === 'SETTLEMENT') {
      addBreakdownRow('Settlement Method', data.settlementType || 'AUTO', nextY);
      nextY += 28;
      this.addSpacing(nextY - this.currentY + 15);
      this.addHorizontalLine();
      this.doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#27ae60')
        .text('Total Settled Amount', leftColX, this.currentY);
      this.doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#27ae60')
        .text(this.formatCurrency(data.settledAmount || 0), rightColX, this.currentY, {
          align: 'right',
          width: this.pageWidth / 2,
        });
      this.currentY += 30;
    } else {
      // Fallback for Disputed Refunds or Generic
      addBreakdownRow(
        'Original Amount',
        this.formatCurrency(data.originalAmount || data.amount || 0),
        nextY,
      );
      nextY += 28;
      if (data.disputeReason) {
        this.doc
          .fontSize(10)
          .font('Helvetica-Oblique')
          .fillColor('#e74c3c')
          .text(`Dispute Reason: ${data.disputeReason}`, leftColX, nextY);
        nextY += 28;
      }
      this.addSpacing(nextY - this.currentY + 15);
      this.addHorizontalLine();
      this.doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#27ae60')
        .text('Net Transacted Amount', leftColX, this.currentY);
      this.doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#27ae60')
        .text(
          this.formatCurrency(data.refundedAmount || data.amount || 0),
          rightColX,
          this.currentY,
          { align: 'right', width: this.pageWidth / 2 },
        );
      this.currentY += 30;
    }

    this.addText(`Payment Date: ${this.formatDate(data.createdAt)}`, {
      fontSize: 9,
      color: '#7f8c8d',
      align: 'right',
    });

    this.currentY = this.doc.page.height - this.margins - 50;
    this.addHorizontalLine();

    // Legal Footer
    this.addText(
      'Payment was facilitated by FixMate-SA (Pty) Ltd on behalf of the service provider.',
      {
        fontSize: 8,
        align: 'center',
        color: '#7f8c8d',
      },
    );
    this.addText('FixMate-SA is not the supplier of the service.', {
      fontSize: 8,
      align: 'center',
      color: '#7f8c8d',
    });
    this.currentY += 5;
    this.addText('Fixmate - Quality Services at Your Fingertips', {
      fontSize: 10,
      align: 'center',
      color: '#0062EB',
    });
  }
}

export async function generateInvoiceAPI(req: Request, res: Response) {
  try {
    if (!req.params.id) throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'You must give the id!');

    const info = await Payment.find({
      _id: new Types.ObjectId(req.params.id),
    }).populate('customer service');
    const data = info[0] as any;
    if (!data) throw new ApiError(StatusCodes.NOT_FOUND, 'Payment details not found!');

    const paymentData: PaymentData = {
      customId: data.customId,
      paymentType: data.paymentType,
      paymentStatus: data.paymentStatus || 'PENDING',
      createdAt: data.createdAt || new Date(),

      service: data.service
        ? {
            price: data.service.price || 0,
            category: data.service.category || 'N/A',
            subCategory: data.service.subCategory || 'N/A',
          }
        : undefined,

      customer: data.customer
        ? {
            name: data.customer.name || 'N/A',
            address: data.customer.address || 'N/A',
            email: data.customer.email || 'N/A',
          }
        : undefined,

      provider: data.provider
        ? {
            name: data.provider.name || 'N/A',
            email: data.provider.email || 'N/A',
          }
        : undefined,

      amount: data.serviceAmount || data.amount || 0,
      platformFee: data.platformFee || 0,
      gatewayFee: data.gatewayFee || 0,
      providerAmount: data.providerAmount || 0,

      originalAmount: data.originalAmount,
      penaltyFee: data.penaltyFee,
      refundedAmount: data.refundedAmount,
      providerDeduction: data.providerDeduction,
      cancellationReason: data.cancellationReason,
      disputeReason: data.disputeReason,

      withdrawAmount: data.withdrawAmount,
      withdrawalFee: data.withdrawalFee,
      netPayout: data.netPayout,

      settledAmount: data.settledAmount,
      settlementType: data.settlementType,
    };

    const pdfMaker = new PDFInvoiceMaker();
    pdfMaker.streamPDFToResponse(
      res,
      paymentData,
      `invoice-${paymentData.customId || Date.now()}.pdf`,
    );
  } catch (error) {
    console.error('Error generating PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to generate PDF invoice' });
    }
  }
}

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
      paymentType: req.body.paymentType || 'SERVICE_PAYMENT',
      createdAt: req.body.createdAt || new Date(),
      customId: req.body.customId || `inv-${Date.now()}`,
    };

    const pdfMaker = new PDFInvoiceMaker();
    const pdfBuffer = await pdfMaker.generatePDFBuffer(paymentData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoice-${paymentData.customId || Date.now()}.pdf"`,
    );
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ success: false, message: 'Failed to generate PDF invoice' });
  }
}

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
      paymentType: data.paymentType || 'SERVICE_PAYMENT',
      createdAt: data.createdAt || new Date(),
      customId: data.customId || `inv-${Date.now()}`,
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
    this.doc = new PDFDocument({ size: 'A4', margin: this.margins });
    this.pageWidth = 595.28 - this.margins * 2;
  }

  private async drawHeader() {
    const now = new Date();
    const headerY = this.currentY;
    const logoUrl = 'https://i.ibb.co.com/Lzs2kqSn/Image20260314205009.png';
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
      .text(text, this.margins, this.currentY, { width: this.pageWidth, align });
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

  private formatCurrency(amount: number) {
    return 'R' + amount.toFixed(2);
  }

  private async renderOrderCard(data: PaymentData, index: number, total: number) {
    const actual = Number(data.amount || 0);
    const colGap = 20;
    const colWidth = (this.pageWidth - colGap) / 2;
    const padding = 16;
    const leftItems = [
      { label: 'Category', value: (data.service as any).category || 'N/A' },
      { label: 'Sub Category', value: (data.service as any).subCategory || 'N/A' },
      { label: 'Customer', value: (data.customer as any).name || 'N/A' },
      { label: 'Provider', value: (data.provider as any)?.name || 'N/A' },
    ];
    const rightItems = [
      { label: 'Total Price', value: this.formatCurrency(actual) },
      { label: 'Commission (18%)', value: this.formatCurrency(data.platformFee || actual * 0.18) },
      { label: 'Gateway Fee (3%)', value: this.formatCurrency(data.gatewayFee || actual * 0.03) },
      { label: 'Provider Net', value: this.formatCurrency(data.providerAmount || actual * 0.82) },
    ];
    const cardHeight = 220;
    const maxY = this.doc.page.height - this.margins - 5;
    if (this.currentY + cardHeight > maxY) {
      this.doc.addPage();
      this.currentY = this.margins;
      await this.drawHeader();
    }
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
      .text(`Order ${index + 1} of ${total}`, this.margins + padding, cardY + padding);
    this.doc.fillColor('#7f8c8d').fontSize(11).font('Helvetica');
    let ly = contentTop;
    leftItems.forEach(i => {
      this.doc.fillColor('#7f8c8d').text(i.label, this.margins + padding, ly);
      this.doc.fillColor('#2c3e50').text(i.value, this.margins + padding, ly + 14);
      ly += 35;
    });
    let ry = contentTop;
    rightItems.forEach(i => {
      this.doc.fillColor('#7f8c8d').text(i.label, this.margins + padding + colWidth + colGap, ry);
      this.doc
        .fillColor('#2c3e50')
        .text(i.value, this.margins + padding + colWidth + colGap, ry + 14);
      ry += 35;
    });
    this.currentY = cardY + cardHeight + 15;
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
          this.addText('Combined Invoices', { fontSize: 18, bold: true, align: 'center' });
          for (let i = 0; i < orders.length; i++) {
            await this.renderOrderCard(orders[i], i, orders.length);
          }
          this.doc.end();
        } catch (e) {
          reject(e);
        }
      })();
    });
  }

  public async streamMultiPDFToResponse(
    res: Response,
    orders: PaymentData[],
    filename: string = 'combined-invoices.pdf',
  ) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    this.doc.pipe(res);
    await this.drawHeader();
    this.addText('Combined Invoices', { fontSize: 18, bold: true, align: 'center' });
    for (let i = 0; i < orders.length; i++) {
      await this.renderOrderCard(orders[i], i, orders.length);
    }
    this.doc.end();
  }
}
