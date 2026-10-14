<?php

namespace App\Http\Controllers\Dev;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Mail\AppointmentChangedMail;
use App\Mail\AppointmentConfirmationMail;
use App\Mail\ClinicTestMail;
use App\Mail\EmployeeInvitationMail;
use App\Mail\InvoiceMail;
use App\Mail\MessageAlertMail;
use App\Mail\OneTimeCodeMail;
use App\Mail\PaymentReceiptMail;
use App\Mail\SecurityNoticeMail;
use App\Models\Appointment;
use App\Models\Branch;
use App\Models\DentistProfile;
use App\Models\EmailVerificationOtp;
use App\Models\Invoice;
use App\Models\InvoiceLine;
use App\Models\Patient;
use App\Models\Person;
use App\Models\Receipt;
use App\Models\Service;
use App\Models\User;
use App\Services\Billing\BillingDocuments;
use App\Support\ClinicClock;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Facades\View;

/**
 * DEV ONLY (routes/web.php registers it only when APP_ENV=local): renders every clinic email, and the two PDFs, with made-up
 * sample data so the design can be checked without sending anything. The sample records are unsaved models: no database
 * record is read or written, nothing is sent. `?theme=dark` forces the dark-mode styles; `?format=text` shows the plain-text part.
 */
class MailPreviewController extends Controller
{
    /** @return array<string, \Closure(): Mailable> */
    public static function samples(): array
    {
        $invitee = new User(['email' => 'new.staff@example.test', 'role' => Role::Staff]);
        $invitee->setRelation('person', new Person(['first_name' => 'Alex']));
        $when = 'October 13, 2026 2:05 PM';

        return [
            'verification-code' => fn () => new OneTimeCodeMail('482913', EmailVerificationOtp::REGISTRATION, 'Maria'),
            'password-reset-code' => fn () => new OneTimeCodeMail('730254', EmailVerificationOtp::PASSWORD_RESET, 'Maria'),
            'email-change-code' => fn () => new OneTimeCodeMail('195847', EmailVerificationOtp::EMAIL_CHANGE, 'Maria'),
            'registration-attempt' => fn () => new SecurityNoticeMail('registration_attempt', 'Maria'),
            'registration-attempt-record' => fn () => new SecurityNoticeMail('registration_attempt_record', 'Maria'),
            'password-changed' => fn () => new SecurityNoticeMail('password_changed', 'Maria', $when),
            'email-changed' => fn () => new SecurityNoticeMail('email_changed', 'Maria', $when, SecurityNoticeMail::mask('maria.new@example.test')),
            'employee-invitation' => fn () => new EmployeeInvitationMail($invitee, rtrim((string) config('app.frontend_url'), '/').'/#accept-invitation?email=new.staff%40example.test&token=SAMPLE-TOKEN', 72),
            'message-alert' => fn () => new MessageAlertMail('Maria'),
            'payment-receipt' => fn () => new PaymentReceiptMail(...self::receiptSample()),
            'payment-receipt-bir' => fn () => new PaymentReceiptMail(...self::receiptSample(withBir: true)),
            'invoice' => fn () => new InvoiceMail(self::invoiceSample()),
            'appointment-confirmation' => fn () => new AppointmentConfirmationMail(self::appointmentSample()),
            'appointment-rescheduled' => fn () => new AppointmentChangedMail(self::appointmentSample(), 'rescheduled'),
            'appointment-cancelled' => fn () => new AppointmentChangedMail(self::appointmentSample('Cancelled'), 'cancelled'),
            'smtp-test' => fn () => new ClinicTestMail(),
        ];
    }

    public static function invoiceSample(bool $withBir = false, string $status = 'Issued'): Invoice
    {
        $branch = (new Branch)->forceFill(['legacy_ref' => 'b1', 'name' => 'Branch A', 'address' => '#37, MacArthur Hwy, Bocaue, 3018 Bulacan', 'phone' => '0922 878 7341']);
        if ($withBir) {
            $branch->forceFill(['bir_registered_name' => 'Sample Dental Services', 'bir_tin' => '000-123-456-00000', 'bir_registered_address' => '#37, MacArthur Hwy, Bocaue, 3018 Bulacan',
                'bir_vat_status' => 'non_vat', 'bir_permit_numbers' => 'SAMPLE ONLY - not a real registration']);
        }
        $person = new Person(['first_name' => 'Maria', 'last_name' => 'Santos']);
        $patient = (new Patient)->forceFill(['billing_address' => ['line1' => '37 MacArthur Highway', 'line2' => '', 'city' => 'Bocaue', 'state' => 'Bulacan', 'postal_code' => '3018', 'country' => 'PH']])
            ->setRelation('person', $person)->setRelation('user', new User(['email' => 'maria.santos@example.test']));
        $paid = $status === 'Paid';
        $invoice = (new Invoice)->forceFill(['public_id' => '01SAMPLEINVOICE0000000000', 'invoice_number' => 'INV-2026-000123', 'status' => $status, 'gross_amount' => '1800.00',
            'hmo_coverage_amount' => '0.00', 'patient_responsibility_amount' => '1800.00', 'paid_amount' => $paid ? '1800.00' : '0.00',
            'issued_at' => now()->subHour(), 'paid_at' => $paid ? now() : null]);
        $invoice->setRelation('branch', $branch)->setRelation('patient', $patient)->setRelation('lines', collect([
            (new InvoiceLine)->forceFill(['line_no' => 1, 'service_name' => 'Oral Prophylaxis (Cleaning)', 'quantity' => 1, 'unit_price' => '1000.00', 'line_total' => '1000.00']),
            (new InvoiceLine)->forceFill(['line_no' => 2, 'service_name' => 'Composite Restoration (Filling)', 'quantity' => 1, 'unit_price' => '800.00', 'line_total' => '800.00']),
        ]));

        return $invoice;
    }

    /** @return array{0: Invoice, 1: Receipt} */
    public static function receiptSample(bool $withBir = false): array
    {
        $invoice = self::invoiceSample($withBir, 'Paid');
        $receipt = (new Receipt)->forceFill(['public_id' => '01SAMPLERECEIPT0000000000', 'receipt_number' => 'RCT-2026-000123', 'amount' => '1800.00',
            'method' => 'PayMongo (CARD)', 'external_reference' => 'pay_SAMPLE0000000000000000', 'issued_at' => now()]);
        $receipt->setRelation('invoice', $invoice);

        return [$invoice, $receipt];
    }

    private static function appointmentSample(string $status = 'Confirmed'): Appointment
    {
        $start = ClinicClock::at(ClinicClock::now()->addDays(3)->toDateString(), '10:30');
        // Unsaved models keep a zone-less date string that is read back as UTC, so sample instants are given in UTC.
        $appointment = (new Appointment)->forceFill(['appointment_code' => 'APT-2026-000045', 'status' => $status, 'starts_at' => $start->utc()]);
        $dentist = (new DentistProfile)->setRelation('person', new Person(['first_name' => 'Dana', 'last_name' => 'Roxas']));
        $appointment->setRelation('patient', (new Patient)->setRelation('person', new Person(['first_name' => 'Maria'])))
            ->setRelation('branch', (new Branch)->forceFill(['name' => 'Branch A', 'address' => '#37, MacArthur Hwy, Bocaue, 3018 Bulacan', 'phone' => '0922 878 7341']))
            ->setRelation('service', new Service(['name' => 'Oral Prophylaxis (Cleaning)']))
            ->setRelation('dentist', $dentist);

        return $appointment;
    }

    /** `?design=fresh|premium` previews a design without changing the setting. */
    private function applyDesign(): void
    {
        if (in_array(request('design'), \App\Support\Brand::DESIGNS, true)) config(['clinic.brand.design' => request('design')]);
    }

    /** A long invoice (14 procedures, some with long names) for checking PDF page breaks. */
    public static function longInvoiceSample(): Invoice
    {
        $invoice = self::invoiceSample();
        $names = ['Comprehensive Oral Examination', 'Periapical Radiograph', 'Oral Prophylaxis (Cleaning)', 'Composite Restoration, Class II, Two Surfaces (Upper Left First Molar)',
            'Composite Restoration, Class I (Lower Right Second Premolar)', 'Fluoride Varnish Application', 'Pit and Fissure Sealant (per tooth)', 'Simple Tooth Extraction',
            'Surgical Extraction of Impacted Lower Third Molar, Including Bone Removal and Sectioning', 'Post-operative Consultation', 'Root Canal Treatment, Anterior Tooth',
            'Temporary Filling', 'Desensitizing Treatment', 'Panoramic Radiograph'];
        $lines = collect();
        $total = 0;
        foreach ($names as $i => $name) {
            $unit = [500, 350, 1000, 1800, 1200, 600, 450, 800, 4500, 300, 6000, 400, 500, 900][$i];
            $qty = in_array($i, [1, 6], true) ? 2 : 1;
            $lines->push((new InvoiceLine)->forceFill(['line_no' => $i + 1, 'service_name' => $name, 'quantity' => $qty, 'unit_price' => number_format($unit, 2, '.', ''), 'line_total' => number_format($unit * $qty, 2, '.', '')]));
            $total += $unit * $qty;
        }
        $amount = number_format($total, 2, '.', '');
        $invoice->forceFill(['invoice_number' => 'INV-2026-000777', 'gross_amount' => $amount, 'patient_responsibility_amount' => $amount])->setRelation('lines', $lines);

        return $invoice;
    }

    public function index()
    {
        View::share('brandPreview', true);
        $rows = collect(self::samples())->map(function ($make, $name) {
            $mail = $make();
            $html = $mail->render();

            return '<tr><td><a href="/dev/mail/'.$name.'">'.e($name).'</a> &middot; <a href="/dev/mail/'.$name.'?design=fresh">A</a> &middot; <a href="/dev/mail/'.$name.'?design=premium">B</a></td><td><a href="/dev/mail/'.$name.'?theme=dark">dark</a></td><td>'.e($mail->envelope()->subject)
                .'</td><td>'.number_format(strlen($html) / 1024, 1).' KB</td><td>'
                .($this->text($mail) !== null ? '<a href="/dev/mail/'.$name.'?format=text">plain text</a>' : 'none').'</td></tr>';
        })->implode('');

        return response('<!doctype html><meta charset="utf-8"><title>Email previews</title><style>body{font-family:system-ui,Arial,sans-serif;padding:24px;color:#182b41}td,th{padding:6px 12px;text-align:left}a{color:#1865ac}</style>'
            .'<h1>Email previews (development only)</h1><p>Sample data only. Nothing is sent and no record is read. The logo is shown inline here; real emails embed it as an attachment (CID).</p>'
            .'<table border="1" cellspacing="0" style="border-collapse:collapse;"><tr><th>Template</th><th>Dark</th><th>Subject</th><th>HTML size</th><th>Text part</th></tr>'.$rows.'</table>'
            .'<h2>PDF copies</h2><p><a href="/dev/mail/pdf/receipt">Payment Receipt PDF</a> &middot; <a href="/dev/mail/pdf/receipt-bir">with BIR fields</a> &middot; <a href="/dev/mail/pdf/invoice">Invoice PDF</a> &middot; <a href="/dev/mail/pdf/invoice-long">long invoice (14 items)</a>. Add ?design=fresh or ?design=premium to any link.</p>');
    }

    public function show(string $template)
    {
        $make = self::samples()[$template] ?? abort(404);
        View::share('brandPreview', true);
        $this->applyDesign();
        $mail = $make();
        if (request('format') === 'text') {
            return response($this->text($mail) ?? abort(404), 200, ['Content-Type' => 'text/plain; charset=UTF-8']);
        }
        $html = $mail->render();
        if (request('theme') === 'dark') {
            // Apply the dark-mode rules unconditionally, so the dark look can be checked in any browser.
            $html = str_replace('@media (prefers-color-scheme: dark)', '@media all', $html);
        }

        return response($html);
    }

    public function pdf(string $document, BillingDocuments $documents)
    {
        $this->applyDesign();
        $bytes = match ($document) {
            'invoice-long' => $documents->invoicePdf(self::longInvoiceSample()),
            'receipt' => $documents->receiptPdf(self::receiptSample()[1]),
            'receipt-bir' => $documents->receiptPdf(self::receiptSample(withBir: true)[1]),
            'invoice' => $documents->invoicePdf(self::invoiceSample()),
            default => abort(404),
        };

        return response($bytes, 200, ['Content-Type' => 'application/pdf', 'Content-Disposition' => 'inline; filename="sample-'.$document.'.pdf"']);
    }

    private function text(Mailable $mail): ?string
    {
        $content = $mail->content();
        if (! $content->text) return null;

        return view($content->text, array_merge($mail->buildViewData(), $content->with))->render();
    }
}
