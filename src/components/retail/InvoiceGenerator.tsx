import { useState, useEffect } from 'react';
import { FileText, Download, Eye, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Transaction } from '@/types/retail';
import jsPDF from 'jspdf';
import { sanitizeForPdf, escapeHtml, sanitizeCurrency, truncateText } from '@/lib/sanitize';
import { useCurrency } from '@/hooks/useCurrency';
import { supabase } from '@/integrations/supabase/client';

interface InvoiceGeneratorProps {
  transaction: Transaction;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  storeEmail?: string;
}

export function InvoiceGenerator({
  transaction,
  storeName: propStoreName,
  storeAddress: propStoreAddress,
  storePhone: propStorePhone,
  storeEmail: propStoreEmail,
}: InvoiceGeneratorProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const { formatCurrency } = useCurrency();
  const [storeInfo, setStoreInfo] = useState({
    name: propStoreName || 'My Store',
    address: propStoreAddress || '',
    phone: propStorePhone || '',
    email: propStoreEmail || '',
  });

  useEffect(() => {
    if (propStoreName) return; // Use props if provided
    const fetchInfo = async () => {
      const { data } = await supabase.from('app_settings').select('key, value').in('key', ['appSettings', 'webstoreSettings']);
      if (data) {
        const app = (data.find(r => r.key === 'appSettings')?.value ?? {}) as Record<string, string>;
        const web = (data.find(r => r.key === 'webstoreSettings')?.value ?? {}) as Record<string, string>;
        setStoreInfo({
          name: web.storeName || app.appName || 'My Store',
          address: app.address || '',
          phone: app.contactPhone || '',
          email: app.contactEmail || '',
        });
      }
    };
    fetchInfo();
  }, [propStoreName]);

  const storeName = storeInfo.name;
  const storeAddress = storeInfo.address;
  const storePhone = storeInfo.phone;
  const storeEmail = storeInfo.email;

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));

  const generatePDF = (download: boolean = true) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Sanitize all store info for PDF
    const safeStoreName = sanitizeForPdf(storeName);
    const safeStoreAddress = sanitizeForPdf(storeAddress);
    const safeStorePhone = sanitizeForPdf(storePhone);
    const safeStoreEmail = sanitizeForPdf(storeEmail);

    // Header
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(safeStoreName, pageWidth / 2, y, { align: 'center' });
    
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(safeStoreAddress, pageWidth / 2, y, { align: 'center' });
    
    y += 5;
    doc.text(`${safeStorePhone} | ${safeStoreEmail}`, pageWidth / 2, y, { align: 'center' });

    // Invoice title
    y += 15;
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', pageWidth / 2, y, { align: 'center' });

    // Invoice details
    y += 12;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    // Sanitize transaction data
    const safeTransactionId = sanitizeForPdf(transaction.id.slice(0, 8).toUpperCase());
    const invoiceNumber = `INV-${safeTransactionId}`;
    const invoiceDate = formatDate(transaction.created_at);
    const safePaymentMethod = sanitizeForPdf(transaction.payment_method.toUpperCase());
    const safeStatus = sanitizeForPdf((transaction.status || 'COMPLETED').toUpperCase());
    
    doc.text(`Invoice #: ${invoiceNumber}`, 20, y);
    doc.text(`Date: ${invoiceDate}`, pageWidth - 20, y, { align: 'right' });

    y += 6;
    doc.text(`Payment Method: ${safePaymentMethod}`, 20, y);
    doc.text(`Status: ${safeStatus}`, pageWidth - 20, y, { align: 'right' });

    // Divider
    y += 10;
    doc.setDrawColor(200);
    doc.line(20, y, pageWidth - 20, y);

    // Items header
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text('Item', 20, y);
    doc.text('Qty', 100, y, { align: 'center' });
    doc.text('Unit Price', 130, y, { align: 'right' });
    doc.text('Total', pageWidth - 20, y, { align: 'right' });

    y += 2;
    doc.line(20, y, pageWidth - 20, y);

    // Items
    y += 8;
    doc.setFont('helvetica', 'normal');
    
    transaction.items.forEach((item) => {
      // Sanitize product name and truncate
      const safeProductName = truncateText(sanitizeForPdf(item.product_name), 35);
      const safeQuantity = String(Math.floor(Math.abs(Number(item.quantity) || 0)));
      const safeUnitPrice = sanitizeCurrency(item.unit_price);
      const safeTotalPrice = sanitizeCurrency(item.total_price);
      
      doc.text(safeProductName, 20, y);
      doc.text(safeQuantity, 100, y, { align: 'center' });
      doc.text(formatCurrency(safeUnitPrice), 130, y, { align: 'right' });
      doc.text(formatCurrency(safeTotalPrice), pageWidth - 20, y, { align: 'right' });
      
      y += 7;
    });

    // Divider
    y += 3;
    doc.line(20, y, pageWidth - 20, y);

    // Totals - sanitize all currency values
    const safeSubtotal = sanitizeCurrency(transaction.subtotal);
    const safeDiscount = sanitizeCurrency(transaction.discount);
    const safeTax = sanitizeCurrency(transaction.tax);
    const safeTotal = sanitizeCurrency(transaction.total);
    
    y += 10;
    doc.text('Subtotal:', 130, y, { align: 'right' });
    doc.text(formatCurrency(safeSubtotal), pageWidth - 20, y, { align: 'right' });

    if (safeDiscount > 0) {
      y += 7;
      doc.setTextColor(0, 128, 0);
      doc.text('Discount:', 130, y, { align: 'right' });
      doc.text(`-${formatCurrency(safeDiscount)}`, pageWidth - 20, y, { align: 'right' });
      doc.setTextColor(0);
    }

    y += 7;
    doc.text('Tax:', 130, y, { align: 'right' });
    doc.text(formatCurrency(safeTax), pageWidth - 20, y, { align: 'right' });

    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL:', 130, y, { align: 'right' });
    doc.text(formatCurrency(safeTotal), pageWidth - 20, y, { align: 'right' });

    // Loyalty points
    if (transaction.loyalty_points_earned && transaction.loyalty_points_earned > 0) {
      y += 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(255, 153, 0);
      doc.text(`Loyalty Points Earned: ${transaction.loyalty_points_earned}`, pageWidth / 2, y, { align: 'center' });
      doc.setTextColor(0);
    }

    // Footer
    y = doc.internal.pageSize.getHeight() - 30;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Thank you for shopping with us!', pageWidth / 2, y, { align: 'center' });
    
    y += 6;
    doc.setFontSize(8);
    doc.text('This is a computer-generated invoice.', pageWidth / 2, y, { align: 'center' });

    if (download) {
      doc.save(`Invoice-${invoiceNumber}.pdf`);
    }
    
    return doc;
  };

  const handlePreview = () => {
    setIsPreviewOpen(true);
  };

  const handlePrint = () => {
    const doc = generatePDF(false);
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  };

  return (
    <>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePreview}
          className="flex-1"
        >
          <Eye className="w-4 h-4 mr-2" />
          Preview
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => generatePDF(true)}
          className="flex-1"
        >
          <Download className="w-4 h-4 mr-2" />
          PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrint}
          className="flex-1"
        >
          <Printer className="w-4 h-4 mr-2" />
          Print
        </Button>
      </div>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Invoice Preview
            </DialogTitle>
          </DialogHeader>

          <div className="bg-white text-black p-8 rounded-lg">
            {/* Store Header */}
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold">{escapeHtml(storeName)}</h1>
              <p className="text-sm text-gray-600">{escapeHtml(storeAddress)}</p>
              <p className="text-sm text-gray-600">{escapeHtml(storePhone)} | {escapeHtml(storeEmail)}</p>
            </div>

            {/* Invoice Title */}
            <h2 className="text-xl font-bold text-center mb-4">INVOICE</h2>

            {/* Invoice Details */}
            <div className="flex justify-between mb-4 text-sm">
              <div>
                <p><strong>Invoice #:</strong> INV-{escapeHtml(transaction.id.slice(0, 8).toUpperCase())}</p>
                <p><strong>Payment:</strong> {escapeHtml(transaction.payment_method.toUpperCase())}</p>
              </div>
              <div className="text-right">
                <p><strong>Date:</strong> {formatDate(transaction.created_at)}</p>
                <p><strong>Status:</strong> {escapeHtml(transaction.status?.toUpperCase() || 'COMPLETED')}</p>
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full mb-4 text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-2">Item</th>
                  <th className="text-center py-2">Qty</th>
                  <th className="text-right py-2">Unit Price</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {transaction.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-200">
                    <td className="py-2">{escapeHtml(item.product_name)}</td>
                    <td className="text-center py-2">{sanitizeCurrency(item.quantity)}</td>
                    <td className="text-right py-2">{formatCurrency(sanitizeCurrency(item.unit_price))}</td>
                    <td className="text-right py-2">{formatCurrency(sanitizeCurrency(item.total_price))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="border-t-2 border-gray-300 pt-4 space-y-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(sanitizeCurrency(transaction.subtotal))}</span>
              </div>
              {sanitizeCurrency(transaction.discount) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(sanitizeCurrency(transaction.discount))}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Tax</span>
                <span>{formatCurrency(sanitizeCurrency(transaction.tax))}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>TOTAL</span>
                <span>{formatCurrency(sanitizeCurrency(transaction.total))}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center mt-6 text-sm text-gray-600">
              <p>Thank you for shopping with us!</p>
              {transaction.loyalty_points_earned && transaction.loyalty_points_earned > 0 && (
                <p className="text-orange-500 font-medium mt-1">
                  You earned {transaction.loyalty_points_earned} loyalty points!
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={() => generatePDF(true)} className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button onClick={handlePrint} variant="outline" className="flex-1">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
