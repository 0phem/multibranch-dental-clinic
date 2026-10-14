<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Services\Billing\BillingDocuments;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Downloads of the same PDFs that are emailed: the invoice (once issued) and its Payment Receipt (once paid). Access follows the
 * invoice's own visibility rule (Invoice::visibleTo): a Patient only their own, Staff their branch scopes, the Owner all.
 * Another person's invoice answers 404, so its existence is not revealed. The file is never cached by the browser.
 */
class BillingDocumentController extends Controller
{
    public function invoice(Request $request, string $invoice, BillingDocuments $documents): Response
    {
        $row = $this->visible($request, $invoice);
        abort_unless(in_array($row->status, ['Issued', 'Paid'], true), 404);

        return $this->pdf($documents->invoicePdf($row), BillingDocuments::invoiceFileName($row));
    }

    public function receipt(Request $request, string $invoice, BillingDocuments $documents): Response
    {
        $row = $this->visible($request, $invoice);
        $receipt = $row->receipt;
        abort_unless($receipt !== null, 404);

        return $this->pdf($documents->receiptPdf($receipt), BillingDocuments::receiptFileName($receipt));
    }

    private function visible(Request $request, string $publicId): Invoice
    {
        return Invoice::visibleTo($request->user())->where('public_id', strtolower($publicId))->firstOrFail();
    }

    private function pdf(string $bytes, string $name): Response
    {
        return response($bytes, 200, ['Content-Type' => 'application/pdf', 'Content-Disposition' => 'attachment; filename="'.$name.'"',
            'Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
    }
}
