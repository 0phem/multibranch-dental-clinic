<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Support\Brand;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Barryvdh\DomPDF\Facade\Pdf;

/**
 * The counter poster of one branch (A5, design A): a QR code and a short link that open the registration page on the patient's
 * phone ("I'm new here" / "I have an account", then "Join today's queue" with the code shown at the front desk). The poster
 * carries no daily code, so it can stay on the counter.
 */
class BranchPosterController extends Controller
{
    public function show(Branch $branch)
    {
        $url = rtrim((string) config('app.frontend_url'), '/').'/#join/'.$branch->legacy_ref;
        $svg = (new Writer(new ImageRenderer(new RendererStyle(480, 2), new SvgImageBackEnd())))->writeString($url);
        $pdf = Pdf::setOption(['isRemoteEnabled' => false, 'defaultFont' => 'DejaVu Sans'])->loadView('pdf.branch-poster', [
            'branch' => $branch, 'url' => $url, 'shortUrl' => preg_replace('#^https?://#', '', $url), 'qr' => 'data:image/svg+xml;base64,'.base64_encode($svg),
            'brand' => Brand::forEmail($branch), 'logo' => Brand::logoDataUri(),
        ])->setPaper('a5');

        return $pdf->download('counter-poster-'.$branch->legacy_ref.'.pdf');
    }
}
