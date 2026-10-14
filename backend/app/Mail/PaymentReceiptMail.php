<?php

namespace App\Mail;

use App\Models\Invoice;
use App\Models\Receipt;
use App\Services\Billing\BillingDocuments;
use App\Support\Brand;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** M11/M18 Payment Receipt email (decision 8: "Payment Receipt", never "Official"). The PDF copy is attached. */
class PaymentReceiptMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Invoice $invoice, public Receipt $receipt)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Payment Receipt '.$this->receipt->receipt_number.' - '.Brand::name());
    }

    public function content(): Content
    {
        $this->receipt->setRelation('invoice', $this->invoice);
        $data = app(BillingDocuments::class)->receipt($this->receipt);

        return new Content(view: 'emails.payment-receipt', text: 'emails.payment-receipt-text', with: $data + [
            'subjectLine' => $this->envelope()->subject, 'portalUrl' => Brand::invoiceUrl($this->invoice->public_id),
            'firstName' => $this->invoice->patient?->person?->first_name ?: 'there',
        ]);
    }

    public function attachments(): array
    {
        $this->receipt->setRelation('invoice', $this->invoice);

        return [Attachment::fromData(fn () => app(BillingDocuments::class)->receiptPdf($this->receipt), BillingDocuments::receiptFileName($this->receipt))
            ->withMime('application/pdf')];
    }
}
