<?php

namespace Tests\Feature\Settings;

use App\Enums\Role;
use App\Http\Controllers\Dev\MailPreviewController;
use App\Mail\OneTimeCodeMail;
use App\Mail\PaymentReceiptMail;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\EmailVerificationOtp;
use App\Models\User;
use App\Services\Billing\BillingDocuments;
use App\Services\Mail\MailDispatcher;
use App\Support\Brand;
use Database\Seeders\ClinicSettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** White-label settings (decision 12): edited by the Owner, applied to every email and PDF without a code change. */
class BrandingSettingsTest extends TestCase
{
    use RefreshDatabase;

    private function owner(): User
    {
        return User::factory()->create(['role' => Role::Owner, 'email' => 'owner@example.test']);
    }

    private function branch(): Branch
    {
        return Branch::create(['legacy_ref' => 'b1', 'name' => 'Branch A', 'branch_code' => 'BRC-A', 'city' => 'Bocaue', 'address' => '#37 MacArthur Hwy', 'phone' => '0922 878 7341',
            'status' => 'Open', 'open_time' => '09:00', 'close_time' => '18:00']);
    }

    private function png(int $w, int $h, string $name = 'logo.png'): UploadedFile
    {
        $img = imagecreatetruecolor($w, $h);
        imagefill($img, 0, 0, imagecolorallocate($img, 20, 120, 200));
        ob_start();
        imagepng($img);
        $bytes = (string) ob_get_clean();
        imagedestroy($img);

        return UploadedFile::fake()->createWithContent($name, $bytes);
    }

    public function test_the_public_branding_shows_the_clinic_defaults_and_the_seeder_stores_them_without_overwriting(): void
    {
        $this->getJson('/api/branding')->assertOk()->assertJsonPath('data.name', config('clinic.brand.name'))
            ->assertJsonPath('data.design', 'fresh')->assertJsonPath('data.colours.primary', '#1865ac');
        $this->seed(ClinicSettingsSeeder::class);
        $this->assertSame(config('clinic.brand.name'), \App\Models\ClinicSetting::find('name')->value);
        \App\Models\ClinicSetting::find('name')->update(['value' => 'Changed By Owner']);
        $this->seed(ClinicSettingsSeeder::class);
        $this->assertSame('Changed By Owner', \App\Models\ClinicSetting::find('name')->value, 'the seeder never overwrites an Owner change');
    }

    public function test_only_the_owner_reads_and_changes_settings(): void
    {
        foreach ([Role::Staff, Role::Dentist, Role::Patient] as $role) {
            Sanctum::actingAs(User::factory()->create(['role' => $role]));
            $this->getJson('/api/settings/branding')->assertForbidden();
            $this->putJson('/api/settings/branding', ['name' => 'X'])->assertForbidden();
        }
        Sanctum::actingAs($this->owner());
        $this->getJson('/api/settings/branding')->assertOk()->assertJsonPath('data.designs.0.key', 'fresh');
    }

    public function test_changes_restyle_emails_and_pdfs_and_are_audited(): void
    {
        $owner = $this->owner();
        Sanctum::actingAs($owner);
        $this->putJson('/api/settings/branding', ['name' => 'Bright Smile Dental', 'name_line' => 'Bright Smile', 'subtitle' => 'Family Dentistry', 'sender_name' => 'Bright Smile Front Desk',
            'design' => 'premium', 'primary' => '#7A2E8C', 'phone' => '(02) 8123 4567', 'email' => 'hello@brightsmile.test'])->assertOk()
            ->assertJsonPath('data.branding.name', 'Bright Smile Dental')->assertJsonPath('data.branding.colours.primary', '#7a2e8c');
        $this->assertSame('premium', Brand::design());
        $html = (new OneTimeCodeMail('602731', EmailVerificationOtp::REGISTRATION))->render();
        foreach (['Bright Smile Dental', 'Bright Smile', 'Family Dentistry', '(02) 8123 4567', 'hello@brightsmile.test', '#7a2e8c'] as $expected) $this->assertStringContainsString($expected, $html);
        $this->assertStringNotContainsString('Dr. Dana E. Roxas', $html);
        [, $receipt] = MailPreviewController::receiptSample();
        $pdf = view('pdf.payment-receipt', app(BillingDocuments::class)->receipt($receipt) + ['brand' => Brand::forEmail(), 'logo' => null, 'wave' => null])->render();
        $this->assertStringContainsString('Bright Smile', $pdf);
        $this->assertSame(1, AuditLog::where('action', 'settings.branding_updated')->count());

        // The sender name is the From name of every email.
        config(['mail.default' => 'array']);
        app(MailDispatcher::class)->send('patient@example.test', new OneTimeCodeMail('602731', EmailVerificationOtp::REGISTRATION), 'email_verification');
        $from = app('mailer')->getSymfonyTransport()->messages()->last()->getOriginalMessage()->getFrom()[0];
        $this->assertSame('Bright Smile Front Desk', $from->getName());

        // Clearing a setting restores the default.
        $this->putJson('/api/settings/branding', ['name' => null, 'design' => null])->assertOk()->assertJsonPath('data.branding.name', config('clinic.brand.name'));
        $this->assertSame('fresh', Brand::design());
    }

    public function test_invalid_settings_are_refused(): void
    {
        Sanctum::actingAs($this->owner());
        $this->putJson('/api/settings/branding', ['primary' => 'blue', 'design' => 'dark', 'phone' => 'call me', 'email' => 'nope', 'sender_name' => "A\nBcc: x@y"])
            ->assertStatus(422)->assertJsonValidationErrors(['primary', 'design', 'phone', 'email', 'sender_name']);
    }

    public function test_the_logo_upload_checks_type_size_and_shape_and_can_be_reset(): void
    {
        Sanctum::actingAs($this->owner());
        $default = Brand::logoPath();
        $this->postJson('/api/settings/branding/logo', ['logo' => UploadedFile::fake()->create('logo.svg', 10, 'image/svg+xml')])->assertStatus(422);
        $this->postJson('/api/settings/branding/logo', ['logo' => UploadedFile::fake()->create('logo.png', 900, 'image/png')])->assertStatus(422);
        $this->postJson('/api/settings/branding/logo', ['logo' => $this->png(64, 64)])->assertStatus(422)->assertJsonValidationErrors('logo');
        $this->postJson('/api/settings/branding/logo', ['logo' => $this->png(600, 200)])->assertStatus(422);
        $this->postJson('/api/settings/branding/logo', ['logo' => $this->png(400, 360)])->assertOk();
        $path = Brand::logoPath();
        $this->assertNotSame($default, $path);
        [$w, $h] = getimagesize($path);
        $this->assertSame(176, max($w, $h), 'stored at most 176 px for emails and PDFs');
        $this->assertSame(1, AuditLog::where('action', 'settings.logo_updated')->count());
        config(['mail.default' => 'array']);
        Mail::to('x@example.test')->send(new OneTimeCodeMail('602731', EmailVerificationOtp::REGISTRATION));
        $inline = collect(app('mailer')->getSymfonyTransport()->messages()->last()->getOriginalMessage()->getAttachments())->first(fn ($p) => $p->getMediaSubtype() === 'png');
        $this->assertSame(file_get_contents($path), $inline->getBody(), 'the uploaded logo is the one embedded in emails');
        $this->deleteJson('/api/settings/branding/logo')->assertOk();
        $this->assertSame($default, Brand::logoPath());
        @unlink($path);
    }

    public function test_branch_bir_fields_are_edited_by_the_owner_and_printed_only_when_filled(): void
    {
        $branch = $this->branch();
        Sanctum::actingAs($this->owner());
        $this->putJson("/api/settings/branches/{$branch->legacy_ref}/bir", ['tin' => 'ABC'])->assertStatus(422)->assertJsonValidationErrors('tin');
        $this->putJson("/api/settings/branches/{$branch->legacy_ref}/bir", ['registered_name' => 'Roxas Dental Services', 'tin' => '000-123-456-00000', 'vat_status' => 'non_vat'])->assertOk()
            ->assertJsonPath('data.branches.0.bir.tin', '000-123-456-00000');
        $this->assertSame(['Registered name' => 'Roxas Dental Services', 'TIN' => '000-123-456-00000', 'VAT status' => 'Non-VAT registered'], Brand::bir($branch->fresh()));
        [$invoice, $receipt] = MailPreviewController::receiptSample();
        $invoice->setRelation('branch', $branch->fresh());
        $this->assertStringContainsString('000-123-456-00000', (new PaymentReceiptMail($invoice, $receipt))->render());
        $this->putJson("/api/settings/branches/{$branch->legacy_ref}/bir", ['registered_name' => '', 'tin' => null])->assertOk();
        $this->assertSame([], Brand::bir($branch->fresh()));
        $this->assertSame(2, AuditLog::where('action', 'settings.branch_bir_updated')->count());
    }
}
