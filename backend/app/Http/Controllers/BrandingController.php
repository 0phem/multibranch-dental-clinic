<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Services\Audit\AuditService;
use App\Support\Brand;
use App\Support\ClinicSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * White-label branding (decision 12).
 *   Public:  GET /api/branding (what every screen shows: name, tagline, contact, design, colours, logo URL)
 *            GET /api/branding/logo (the logo PNG)
 *   Owner:   GET/PUT /api/settings/branding, POST/DELETE /api/settings/branding/logo, PUT /api/settings/branches/{branch}/bir
 * Emails and PDFs read the same settings through App\Support\Brand, so a change applies to them without a code change.
 */
class BrandingController extends Controller
{
    private const HEX = 'regex:/^#[0-9a-fA-F]{6}$/';

    public function __construct(private readonly AuditService $audit, private readonly ClinicSettings $settings) {}

    private function publicBranding(): array
    {
        $b = Brand::forEmail();
        $logo = Brand::logoPath();

        return [
            'name' => $b['name'], 'name_line' => $b['name_line'], 'subtitle' => $b['subtitle'],
            'address' => $b['address'], 'phone' => $b['phone'], 'email' => $b['email'], 'design' => $b['design'],
            'colours' => ['primary' => $b['primary'], 'primary_dark' => $b['primary_dark'], 'accent' => $b['accent'], 'accent_dark' => $b['accent_dark']],
            'logo_url' => $logo ? url('/api/branding/logo').'?v='.substr(md5_file($logo), 0, 10) : null,
            'logo_custom' => Brand::hasCustomLogo(),
        ];
    }

    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->publicBranding()]);
    }

    public function logo()
    {
        $path = Brand::logoPath() ?? abort(404);

        return response()->file($path, ['Content-Type' => 'image/png', 'Cache-Control' => 'public, max-age=86400']);
    }

    /** Owner: every setting, which ones are custom, and the branches with their optional BIR fields. */
    public function settings(): JsonResponse
    {
        $saved = $this->settings->all();

        return response()->json(['data' => [
            'branding' => $this->publicBranding() + ['sender_name' => Brand::senderName()],
            'custom' => array_values(array_intersect(ClinicSettings::KEYS, array_keys($saved))),
            'designs' => [['key' => 'fresh', 'label' => 'A: Fresh and airy'], ['key' => 'premium', 'label' => 'B: Confident and premium']],
            'branches' => Branch::query()->orderBy('name')->get()->map(fn (Branch $b) => [
                'id' => $b->legacy_ref ?? $b->public_id, 'name' => $b->name, 'address' => $b->address, 'phone' => $b->phone,
                'bir' => ['registered_name' => $b->bir_registered_name, 'tin' => $b->bir_tin, 'registered_address' => $b->bir_registered_address,
                    'vat_status' => $b->bir_vat_status, 'permit_numbers' => $b->bir_permit_numbers],
            ])->values(),
        ]]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'nullable', 'string', 'max:120', 'not_regex:/[\r\n]/'],
            'name_line' => ['sometimes', 'nullable', 'string', 'max:80', 'not_regex:/[\r\n]/'],
            'subtitle' => ['sometimes', 'nullable', 'string', 'max:80', 'not_regex:/[\r\n]/'],
            'sender_name' => ['sometimes', 'nullable', 'string', 'max:80', 'not_regex:/[\r\n<>"]/'],
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:40', 'regex:/^[0-9+()\s.-]+$/'],
            'email' => ['sometimes', 'nullable', 'email:rfc', 'max:255'],
            'design' => ['sometimes', 'nullable', 'in:fresh,premium'],
            'primary' => ['sometimes', 'nullable', self::HEX],
            'primary_dark' => ['sometimes', 'nullable', self::HEX],
            'accent' => ['sometimes', 'nullable', self::HEX],
            'accent_dark' => ['sometimes', 'nullable', self::HEX],
        ]);
        $changed = $this->settings->put(array_map(fn ($v) => is_string($v) && str_starts_with($v, '#') ? strtolower($v) : $v, $data), $request->user());
        if ($changed) {
            $this->audit->record(['action' => 'settings.branding_updated', 'category' => 'administrative', 'actor' => $request->user(), 'payload' => ['changed' => $changed]]);
        }

        return $this->settings();
    }

    /** A PNG or JPEG, at most 512 KB, at least 128 px, roughly square; stored as a PNG of at most 176 px for emails and PDFs. */
    public function uploadLogo(Request $request): JsonResponse
    {
        $request->validate(['logo' => ['required', 'file', 'mimes:png,jpg,jpeg', 'mimetypes:image/png,image/jpeg', 'max:512',
            'dimensions:min_width=128,min_height=128,max_width=4000,max_height=4000']]);
        $file = $request->file('logo');
        [$w, $h] = getimagesize($file->getRealPath()) ?: [0, 0];
        if (! $w || ! $h || $w / $h > 2 || $h / $w > 2) {
            return response()->json(['message' => 'Use a roughly square logo (no more than twice as wide as it is tall).', 'errors' => ['logo' => ['Use a roughly square logo.']]], 422);
        }
        $source = @imagecreatefromstring((string) file_get_contents($file->getRealPath()));
        if (! $source) {
            return response()->json(['message' => 'That image could not be read.', 'errors' => ['logo' => ['That image could not be read.']]], 422);
        }
        $scale = min(1, 176 / max($w, $h));
        [$tw, $th] = [max(1, (int) round($w * $scale)), max(1, (int) round($h * $scale))];
        $target = imagecreatetruecolor($tw, $th);
        imagealphablending($target, false);
        imagesavealpha($target, true);
        imagefill($target, 0, 0, imagecolorallocatealpha($target, 255, 255, 255, 127));
        imagecopyresampled($target, $source, 0, 0, 0, 0, $tw, $th, $w, $h);
        $dir = storage_path('app/brand');
        if (! is_dir($dir)) mkdir($dir, 0775, true);
        ob_start();
        imagepng($target, null, 9);
        $png = (string) ob_get_clean();
        imagedestroy($source);
        imagedestroy($target);
        $name = 'logo-'.substr(hash('sha256', $png), 0, 16).'.png';
        file_put_contents($dir.'/'.$name, $png);
        $this->settings->put(['logo' => $name], $request->user());
        $this->audit->record(['action' => 'settings.logo_updated', 'category' => 'administrative', 'actor' => $request->user(), 'payload' => ['width' => $tw, 'height' => $th, 'bytes' => strlen($png)]]);

        return $this->settings();
    }

    public function resetLogo(Request $request): JsonResponse
    {
        if ($this->settings->put(['logo' => null], $request->user())) {
            $this->audit->record(['action' => 'settings.logo_reset', 'category' => 'administrative', 'actor' => $request->user()]);
        }

        return $this->settings();
    }

    /** Optional BIR registration details for one branch (decision 8); empty values are cleared. */
    public function updateBranchBir(Request $request, Branch $branch): JsonResponse
    {
        $data = $request->validate([
            'registered_name' => ['nullable', 'string', 'max:255'],
            'tin' => ['nullable', 'string', 'max:30', 'regex:/^[0-9 -]+$/'],
            'registered_address' => ['nullable', 'string', 'max:255'],
            'vat_status' => ['nullable', 'in:vat,non_vat'],
            'permit_numbers' => ['nullable', 'string', 'max:255'],
        ]);
        $clean = fn ($v) => is_string($v) && trim($v) !== '' ? trim($v) : null;
        $branch->forceFill([
            'bir_registered_name' => $clean($data['registered_name'] ?? null), 'bir_tin' => $clean($data['tin'] ?? null),
            'bir_registered_address' => $clean($data['registered_address'] ?? null), 'bir_vat_status' => $clean($data['vat_status'] ?? null),
            'bir_permit_numbers' => $clean($data['permit_numbers'] ?? null),
        ])->save();
        $this->audit->record(['action' => 'settings.branch_bir_updated', 'category' => 'administrative', 'actor' => $request->user(), 'target' => $branch, 'branch_id' => $branch->id,
            'payload' => ['filled' => array_keys(array_filter(Brand::bir($branch)))]]);

        return $this->settings();
    }
}
