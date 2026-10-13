<?php

namespace App\Services\Billing;

use App\Models\Invoice;
use App\Models\Receipt;
use App\Support\Brand;
use Barryvdh\DomPDF\Facade\Pdf;

/**
 * What a Payment Receipt or Invoice shows (decisions 8 and 10), shared by the emails and their PDF copies so both always agree.
 * Read-only: it formats stored records and never changes them. Titles are "Payment Receipt" and "Invoice"; BIR fields appear
 * only when the branch has them filled in.
 */
class BillingDocuments
{
    /** @return array<string, mixed> */
    public function receipt(Receipt $receipt): array
    {
        $invoice = $receipt->invoice;
        $invoice->loadMissing(['lines', 'branch', 'patient.person']);
        $balance = $invoice->balance();

        return [
            'invoice' => $invoice, 'receipt' => $receipt, 'branch' => $invoice->branch,
            'patientName' => $this->patientName($invoice),
            'amount' => Brand::money($receipt->amount),
            'paidAt' => Brand::dateTime($receipt->issued_at),
            'method' => Brand::paymentMethod($receipt->method),
            'reference' => $receipt->external_reference,
            'balance' => Brand::money($balance),
            'settled' => (float) $balance <= 0,
            'bir' => Brand::bir($invoice->branch),
        ];
    }

    /** @return array<string, mixed> */
    public function invoice(Invoice $invoice): array
    {
        $invoice->loadMissing(['lines', 'branch', 'patient.person']);
        $balance = $invoice->balance();

        return [
            'invoice' => $invoice, 'branch' => $invoice->branch,
            'patientName' => $this->patientName($invoice),
            'amountDue' => Brand::money($balance),
            'issuedOn' => Brand::date($invoice->issued_at),
            'paid' => $invoice->status === 'Paid' || (float) $balance <= 0,
            'bir' => Brand::bir($invoice->branch),
        ];
    }

    public function receiptPdf(Receipt $receipt): string
    {
        return $this->pdf('pdf.payment-receipt', $this->receipt($receipt));
    }

    public function invoicePdf(Invoice $invoice): string
    {
        return $this->pdf('pdf.invoice', $this->invoice($invoice));
    }

    public static function receiptFileName(Receipt $receipt): string
    {
        return 'Payment-Receipt-'.preg_replace('/[^A-Za-z0-9-]/', '', $receipt->receipt_number).'.pdf';
    }

    public static function invoiceFileName(Invoice $invoice): string
    {
        return 'Invoice-'.preg_replace('/[^A-Za-z0-9-]/', '', $invoice->invoice_number).'.pdf';
    }

    private function pdf(string $view, array $data): string
    {
        // No remote fetches: the logo is a data URI and every style is inline.
        return Pdf::setOption(['isRemoteEnabled' => false, 'isFontSubsettingEnabled' => true, 'defaultFont' => 'DejaVu Sans'])
            ->loadView($view, $data + ['brand' => Brand::forEmail($data['branch'] ?? null), 'logo' => Brand::logoDataUri()])
            ->setPaper('a4')->output();
    }

    private function patientName(Invoice $invoice): string
    {
        $person = $invoice->patient?->person;

        return trim(($person?->first_name ?? '').' '.($person?->last_name ?? '')) ?: 'Patient';
    }
}
