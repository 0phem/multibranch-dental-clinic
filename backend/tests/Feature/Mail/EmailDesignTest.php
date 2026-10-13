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

    public function test_the_logo_is_embedded_in_the_message_as_a_cid_image_not_a_remote_or_data_url(): void
    {
        $email = $this->sent(new OneTimeCodeMail('602731', EmailVerificationOtp::REGISTRATION, 'Maria'));
        $html = $email->getHtmlBody();
        $this->assertMatchesRegularExpression('/<img src="cid:[^"]+" width="44" height="44" alt="[^"]+ logo"/', $html);
        $this->assertStringNotContainsString('data:image', $html);
        $this->assertStringNotContainsString('ngrok', $html);
        $inline = collect($email->getAttachments())->filter(fn ($part) => $part->getMediaType().'/'.$part->getMediaSubtype() === 'image/png'
            && $part->getPreparedHeaders()->getHeaderBody('Content-Disposition') === 'inline');
        $this->assertCount(1, $inline);
        $this->assertLessThan(40 * 1024, strlen($inline->first()->getBody()));
        $this->assertNotNull($email->getTextBody());
    }

    public function test_the_receipt_email_shows_plain_payment_words_and_attaches_its_branded_pdf(): void
    {
        [$invoice, $receipt] = MailPreviewController::receiptSample();
        $html = (new PaymentReceiptMail($invoice, $receipt))->render();
        foreach (['Payment Receipt', 'Paid', '₱1,800.00', 'RCT-2026-000123', 'INV-2026-000123', 'Branch A', 'Card', 'pay_SAMPLE0000000000000000', 'Fully settled',
            'View in your patient portal', 'A PDF copy of this Payment Receipt is attached', 'Oral Prophylaxis (Cleaning)', 'Subtotal'] as $expected) {
            $this->assertStringContainsString($expected, $html);
        }
        $this->assertStringNotContainsString('PayMongo (CARD)', $html);
        $this->assertStringNotContainsString('Business registration', $html, 'no BIR block when the branch has none');

        $email = $this->sent(new PaymentReceiptMail(...MailPreviewController::receiptSample()));
        $pdf = collect($email->getAttachments())->first(fn ($part) => $part->getMediaSubtype() === 'pdf');
        $this->assertNotNull($pdf);
        $this->assertSame('Payment-Receipt-RCT-2026-000123.pdf', $pdf->getFilename());
        $this->assertStringStartsWith('%PDF', $pdf->getBody());
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
        $this->assertStringContainsString('#0c9b8e', $html, 'an invalid colour falls back to the default accent');
        $this->assertStringNotContainsString('not-a-colour', $html);
        config(['clinic.brand.logo' => '/nonexistent/logo.png']);
        $this->assertStringNotContainsString('<img', (new OneTimeCodeMail('602731', EmailVerificationOtp::REGISTRATION))->render(), 'a missing logo shows the name only');
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
}
