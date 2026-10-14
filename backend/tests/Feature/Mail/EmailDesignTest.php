<?php

namespace Tests\Feature\Mail;

use App\Http\Controllers\Dev\MailPreviewController;
use App\Mail\InvoiceMail;
use App\Mail\OneTimeCodeMail;
use App\Mail\PaymentReceiptMail;
use App\Models\EmailVerificationOtp;
use App\Models\Invoice;
use App\Models\MailDispatch;
use App\Services\Billing\BillingDocuments;
use App\Support\Brand;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoUnpaidInvoiceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mime\Email;
use Tests\TestCase;

/** The shared branded email layout, the Payment Receipt / Invoice emails and their PDF copies. */
class EmailDesignTest extends TestCase
{
    use RefreshDatabase;

    private function text(Mailable $mail): string
    {
        return view($mail->content()->text, array_merge($mail->buildViewData(), $mail->content()->with))->render();
    }

    /** Sends through the in-memory mailer and returns the real MIME message (with the embedded logo and attachments). */
    private function sent(Mailable $mail): Email
    {
        config(['mail.default' => 'array']);
        Mail::to('someone@example.test')->send($mail);

        return app('mailer')->getSymfonyTransport()->messages()->last()->getOriginalMessage();
    }

    public function test_every_template_renders_html_and_text_with_the_shared_branded_layout_and_no_official_wording(): void
    {
        foreach (MailPreviewController::samples() as $name => $make) {
            $mail = $make();
            $html = $mail->render();
            $text = $this->text($mail);
            $subject = $mail->envelope()->subject;
            $this->assertStringContainsString('max-width:600px', $html, $name);
            $this->assertStringContainsString(Brand::name(), $html, $name);
            $this->assertStringContainsString('Clinic staff will never ask you for your password or a one-time code.', $html, $name);
            $this->assertStringContainsString('prefers-color-scheme: dark', $html, $name);
            $this->assertNotSame('', trim($text), $name.' has a plain-text part');
            foreach ([$html, $text, $subject] as $part) {
                $this->assertDoesNotMatchRegularExpression('/official/i', $part, $name.': never "Official"');
            }
        }
    }

    public function test_no_secret_appears_in_any_email(): void
    {
        $secrets = ['SMTP-PASSWORD-SENTINEL', 'sk_test_SECRET_SENTINEL', 'whsk_SENTINEL', 'REVERB-SECRET-SENTINEL'];
        config(['mail.mailers.smtp.password' => $secrets[0], 'services.paymongo.secret_key' => $secrets[1], 'services.paymongo.webhook_secret' => $secrets[2],
            'reverb.apps.apps.0.secret' => $secrets[3]]);
        $appKey = (string) config('app.key');
        foreach (MailPreviewController::samples() as $name => $make) {
            $mail = $make();
            $all = $mail->render().$this->text($mail).$mail->envelope()->subject;
            foreach ($secrets as $secret) $this->assertStringNotContainsString($secret, $all, $name);
            $this->assertStringNotContainsString($appKey, $all, $name);
        }
    }

    public function test_the_one_time_code_appears_once_in_the_code_block_and_nowhere_that_could_sign_someone_in(): void
    {
        foreach ([EmailVerificationOtp::REGISTRATION, EmailVerificationOtp::PASSWORD_RESET, EmailVerificationOtp::EMAIL_CHANGE] as $purpose) {
            $mail = new OneTimeCodeMail('602731', $purpose, 'Maria');
            $html = $mail->render();
            $this->assertSame(1, substr_count($html, '602731'), $purpose);
            $this->assertStringContainsString('>602731</div>', $html, 'one unbroken string, so a copy gives exactly the six digits');
            $this->assertStringContainsString('Expires in 10 minutes', $html);
            $this->assertSame(1, substr_count($this->text($mail), '602731'));
            $this->assertStringNotContainsString('602731', $mail->envelope()->subject);
            // The only links are the clinic's phone and email in the footer: no button, no sign-in or verification link.
            preg_match_all('/href="([^"]+)"/', $html, $links);
            foreach ($links[1] as $href) $this->assertMatchesRegularExpression('/^(tel:|mailto:)/', $href, $purpose);
        }
    }

    public function test_the_logo_is_embedded_in_the_message_as_a_cid_image_not_a_remote_or_data_url_in_both_designs(): void
    {
        // premium (B): logo only; fresh (A): logo plus the wave divider, both embedded PNGs.
        foreach (['premium' => [60, 1], 'fresh' => [64, 2]] as $design => [$size, $images]) {
            config(['clinic.brand.design' => $design]);
            $email = $this->sent(new OneTimeCodeMail('602731', EmailVerificationOtp::REGISTRATION, 'Maria'));
            $html = $email->getHtmlBody();
            $this->assertMatchesRegularExpression('/<img src="cid:[^"]+" width="'.$size.'" height="'.$size.'" alt="[^"]+ logo"/', $html, $design);
            $this->assertStringNotContainsString('data:image', $html, $design);
            $this->assertStringNotContainsString('ngrok', $html, $design);
            $this->assertDoesNotMatchRegularExpression('/<img src="https?:/', $html, $design.': no remote images');
            $inline = collect($email->getAttachments())->filter(fn ($part) => $part->getMediaType().'/'.$part->getMediaSubtype() === 'image/png'
                && $part->getPreparedHeaders()->getHeaderBody('Content-Disposition') === 'inline');
            $this->assertCount($images, $inline, $design);
            foreach ($inline as $part) $this->assertLessThan(40 * 1024, strlen($part->getBody()), $design);
            $this->assertSame($images, preg_match_all('/<img src="cid:/', $html), $design.': every image is a CID image');
            $this->assertNotNull($email->getTextBody());
            $this->assertDoesNotMatchRegularExpression('/official/i', $html.$email->getTextBody().$email->getSubject(), $design);
        }
    }

    public function test_the_receipt_email_shows_plain_payment_words_and_attaches_its_branded_pdf_in_both_designs(): void
    {
        foreach (['fresh', 'premium'] as $design) {
            config(['clinic.brand.design' => $design]);
            [$invoice, $receipt] = MailPreviewController::receiptSample();
            $mail = new PaymentReceiptMail($invoice, $receipt);
            $html = $mail->render();
            foreach (['Payment Receipt', 'Paid', 'Amount paid', '₱1,800.00', 'RCT-2026-000123', 'INV-2026-000123', 'Dr. Dana Roxas Dental Clinic', 'Card', 'Fully settled',
                'Oral Prophylaxis (Cleaning)', 'Composite Restoration (Filling)', '₱1,000.00', '₱800.00', 'Subtotal', 'Total',
                'A PDF copy of this Payment Receipt is attached', 'Next steps', 'Book your next appointment', 'View your receipts'] as $expected) {
                $this->assertStringContainsString($expected, $html, "$design: $expected");
            }
            $this->assertStringNotContainsString('PayMongo (CARD)', $html, $design.': the method in plain words only');
            $this->assertStringContainsString('…00000000', $html, $design.': the reference is shortened in the email');
            $this->assertStringNotContainsString('pay_SAMPLE0000000000000000', $html, $design.': the full reference is in the PDF, not the email');
            $this->assertStringNotContainsString('Business registration', $html, 'no BIR block when the branch has none');
            $this->assertStringContainsString('font-size:16px', $html, $design.': 16px body text');
            $this->assertStringContainsString('font-size:44px', $html, $design.': the amount is the hero');
            $this->assertDoesNotMatchRegularExpression('/official/i', $html.$this->text($mail).$mail->envelope()->subject, $design);
            $this->assertStringContainsString('Reference: …00000000', $this->text($mail));

            $email = $this->sent(new PaymentReceiptMail(...MailPreviewController::receiptSample()));
            $pdf = collect($email->getAttachments())->first(fn ($part) => $part->getMediaSubtype() === 'pdf');
            $this->assertNotNull($pdf, $design);
            $this->assertSame('Payment-Receipt-RCT-2026-000123.pdf', $pdf->getFilename());
            $this->assertStringStartsWith('%PDF', $pdf->getBody());
            $pdfHtml = view('pdf.payment-receipt', app(BillingDocuments::class)->receipt($receipt) + ['brand' => Brand::forEmail($invoice->branch), 'logo' => null, 'wave' => null])->render();
            $this->assertStringContainsString('pay_SAMPLE0000000000000000', $pdfHtml, $design.': the PDF shows the full reference');
        }
    }

    public function test_a_long_invoice_pdf_breaks_across_pages_without_splitting_rows_in_both_designs(): void
    {
        $invoice = MailPreviewController::longInvoiceSample();
        $this->assertGreaterThanOrEqual(14, $invoice->lines->count());
        foreach (['fresh', 'premium'] as $design) {
            config(['clinic.brand.design' => $design]);
            $bytes = app(BillingDocuments::class)->invoicePdf($invoice);
            $this->assertStringStartsWith('%PDF', $bytes, $design);
            $this->assertGreaterThan(1, preg_match_all('#/Type\s*/Page[^s]#', $bytes), $design.': more than one page');
            $html = view('pdf.invoice', app(BillingDocuments::class)->invoice($invoice) + ['brand' => Brand::forEmail($invoice->branch), 'logo' => null, 'wave' => null])->render();
            // Rows never split across a page break, and the column headings repeat on every page.
            $this->assertStringContainsString('.items tr { page-break-inside: avoid; }', $html, $design);
            $this->assertStringContainsString('.items thead { display: table-header-group; }', $html, $design);
            $this->assertSame($invoice->lines->count(), substr_count($html, '<td class="qty">'), $design.': every procedure is listed');
            $this->assertDoesNotMatchRegularExpression('/official/i', $html, $design);
        }
    }

    public function test_bir_fields_appear_only_when_the_branch_has_them(): void
    {
        [$invoice, $receipt] = MailPreviewController::receiptSample(withBir: true);
        $html = (new PaymentReceiptMail($invoice, $receipt))->render();
        $this->assertStringContainsString('Business registration', $html);
        $this->assertStringContainsString('000-123-456-00000', $html);
        $this->assertStringContainsString('Non-VAT registered', $html);
        $pdfHtml = view('pdf.payment-receipt', app(BillingDocuments::class)->receipt($receipt) + ['brand' => Brand::forEmail($invoice->branch), 'logo' => null])->render();
        $this->assertStringContainsString('000-123-456-00000', $pdfHtml);
        $this->assertStringNotContainsString('Business registration', view('pdf.invoice', app(BillingDocuments::class)->invoice(MailPreviewController::invoiceSample())
            + ['brand' => Brand::forEmail(), 'logo' => null])->render());
    }

    public function test_the_pdfs_carry_the_brand_and_the_right_titles(): void
    {
        $documents = app(BillingDocuments::class);
        [, $receipt] = MailPreviewController::receiptSample();
        foreach ([['pdf.payment-receipt', $documents->receipt($receipt), 'Payment Receipt'], ['pdf.invoice', $documents->invoice(MailPreviewController::invoiceSample()), 'Invoice']] as [$view, $data, $title]) {
            $html = view($view, $data + ['brand' => Brand::forEmail($data['branch']), 'logo' => Brand::logoDataUri()])->render();
            $this->assertStringContainsString($title, $html);
            $this->assertStringContainsString('data:image/png;base64,', $html, 'the logo is inside the PDF, never fetched');
            $this->assertStringContainsString(Brand::name(), $html);
            $this->assertDoesNotMatchRegularExpression('/official/i', $html);
        }
        $this->assertStringStartsWith('%PDF', $documents->invoicePdf(MailPreviewController::invoiceSample()));
    }

    public function test_brand_settings_restyle_every_template_and_bad_colours_fall_back(): void
    {
        config(['clinic.brand.name' => 'Sample Smiles Clinic', 'clinic.brand.primary' => '#7a2e8c', 'clinic.brand.accent' => 'not-a-colour']);
        $html = (new OneTimeCodeMail('602731', EmailVerificationOtp::REGISTRATION))->render();
        $this->assertStringContainsString('Sample Smiles Clinic', $html);
        $this->assertStringContainsString('#7a2e8c', $html);
        $this->assertStringNotContainsString('not-a-colour', $html);
        // The accent is used by design B's header rule: an invalid accent falls back to the default there.
        config(['clinic.brand.design' => 'premium']);
        $premium = (new OneTimeCodeMail('602731', EmailVerificationOtp::REGISTRATION))->render();
        $this->assertStringContainsString('#0c9b8e', $premium, 'an invalid colour falls back to the default accent');
        $this->assertStringNotContainsString('not-a-colour', $premium);
        config(['clinic.brand.logo' => '/nonexistent/logo.png']);
        foreach (['premium', 'fresh'] as $design) {
            config(['clinic.brand.design' => $design]);
            $this->assertStringNotContainsString('logo"', (new OneTimeCodeMail('602731', EmailVerificationOtp::REGISTRATION))->render(), "$design: a missing logo shows the name only");
        }
    }

    public function test_payment_methods_are_shown_in_plain_words(): void
    {
        $this->assertSame(['Card', 'GCash', 'Maya', 'QR Ph', 'Online banking', 'Cash'], array_map([Brand::class, 'paymentMethod'],
            ['PayMongo (CARD)', 'PayMongo (GCASH)', 'PayMongo (MAYA)', 'PayMongo (QR PH)', 'PayMongo (ONLINE BANKING)', 'Cash']));
    }

    public function test_issuing_an_invoice_emails_it_to_the_patient_with_the_pdf_once(): void
    {
        Mail::fake();
        $this->seed(DatabaseSeeder::class);
        $this->seed(DemoUnpaidInvoiceSeeder::class);
        $invoice = Invoice::sole();
        $this->assertSame(1, MailDispatch::where('purpose', 'invoice_issued')->where('subject_public_id', $invoice->public_id)->count());
        Mail::assertSent(InvoiceMail::class, fn (InvoiceMail $mail) => $mail->hasTo('patient@example.test') && $mail->invoice->is($invoice)
            && str_contains($mail->render(), 'Payment due') && str_contains($mail->render(), 'Review and pay') && count($mail->attachments()) === 1);
        Mail::assertSent(InvoiceMail::class, 1);
    }

    public function test_plain_text_parts_show_names_and_symbols_as_written_not_html_entities(): void
    {
        $text = $this->text(new OneTimeCodeMail('602731', EmailVerificationOtp::REGISTRATION, "Ma'ria & Co"));
        $this->assertStringContainsString("Hi Ma'ria & Co,", $text);
        $this->assertStringNotContainsString('&#039;', $text);
        $this->assertStringNotContainsString('&amp;', $text);
        [$invoice, $receipt] = MailPreviewController::receiptSample();
        $invoice->patient->person->first_name = "D'Angelo";
        $this->assertStringContainsString("Hi D'Angelo,", $this->text(new PaymentReceiptMail($invoice, $receipt)));
        $this->assertStringContainsString('Hi D&#039;Angelo', (new PaymentReceiptMail($invoice, $receipt))->render(), 'the HTML part still escapes');
    }

    public function test_receipt_and_invoice_buttons_open_that_invoice_in_the_portal(): void
    {
        [$invoice, $receipt] = MailPreviewController::receiptSample();
        $link = 'http://localhost:5173/?invoice=01SAMPLEINVOICE0000000000#sign-in';
        config(['app.frontend_url' => 'http://localhost:5173']);
        $this->assertStringContainsString('href="'.$link.'"', (new PaymentReceiptMail($invoice, $receipt))->render());
        $this->assertStringContainsString('href="'.$link.'"', (new InvoiceMail(MailPreviewController::invoiceSample()))->render());
        $this->assertStringContainsString('Review and pay: '.$link, $this->text(new InvoiceMail(MailPreviewController::invoiceSample())));
    }

    public function test_the_totals_never_sit_alone_on_a_page_whatever_the_number_of_procedures(): void
    {
        $documents = app(BillingDocuments::class);
        foreach (['fresh', 'premium'] as $design) {
            config(['clinic.brand.design' => $design]);
            foreach (range(1, 30) as $n) {
                $invoice = MailPreviewController::invoiceSample();
                $lines = collect(range(1, $n))->map(fn ($i) => (new \App\Models\InvoiceLine)->forceFill(['line_no' => $i, 'quantity' => 1, 'unit_price' => '100.00', 'line_total' => '100.00',
                    'service_name' => 'Procedure '.$i.($i % 5 === 0 ? ' with an extra long description that wraps onto a second line' : '')]));
                $invoice->forceFill(['gross_amount' => $n * 100, 'patient_responsibility_amount' => $n * 100])->setRelation('lines', $lines);
                $this->assertStringStartsWith('%PDF', $documents->invoicePdf($invoice));
                $layout = $documents->lastLayout;
                // The second-to-last procedure, the totals and the note end on the same page.
                $this->assertSame($layout['pdf-tail'], $layout['pdf-totals'], "$design, $n procedures");
                $this->assertSame($layout['pdf-tail'], $layout['pdf-end'], "$design, $n procedures");
            }
        }
    }
}
