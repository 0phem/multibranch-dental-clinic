@php($money = fn ($v) => \App\Support\Brand::money($v))
<div class="section">Procedures</div>
<table class="grid items">
    <thead><tr><th>Procedure</th><th class="c">Qty</th><th class="r" style="text-align:right;">Unit price</th><th class="r" style="text-align:right;">Amount</th></tr></thead>
    <tbody>
    @foreach ($invoice->lines as $line)
        <tr><td>{{ $line->service_name }}</td><td class="c">{{ $line->quantity }}</td><td class="r">{{ $money($line->unit_price) }}</td><td class="r">{{ $money($line->line_total) }}</td></tr>
    @endforeach
        <tr class="sum"><td colspan="3" class="r">Subtotal</td><td class="r">{{ $money($invoice->gross_amount) }}</td></tr>
    @if ((float) $invoice->hmo_coverage_amount > 0)
        <tr class="sum"><td colspan="3" class="r">HMO coverage</td><td class="r">&minus;{{ $money($invoice->hmo_coverage_amount) }}</td></tr>
    @endif
        <tr class="total"><td colspan="3" class="r">Total</td><td class="r">{{ $money($invoice->patient_responsibility_amount) }}</td></tr>
    </tbody>
</table>
