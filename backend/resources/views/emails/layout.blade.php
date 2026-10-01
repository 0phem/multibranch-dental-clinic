<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $subject ?? 'Dr. Dana E. Roxas Dental Clinic' }}</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #f1f5f9;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
        }
        .wrapper {
            width: 100%;
            background-color: #f1f5f9;
            padding: 32px 16px;
            box-sizing: border-box;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
        }
        .header {
            background-color: #0f172a;
            color: #ffffff;
            padding: 24px 32px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 20px;
            font-weight: 700;
            letter-spacing: -0.025em;
        }
        .header p {
            margin: 4px 0 0;
            font-size: 13px;
            color: #94a3b8;
        }
        .content {
            padding: 32px;
        }
        .content h2 {
            margin-top: 0;
            font-size: 18px;
            font-weight: 600;
            color: #0f172a;
        }
        .card {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px 20px;
            margin: 20px 0;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e2e8f0;
            font-size: 14px;
        }
        .detail-row:last-child {
            border-bottom: none;
        }
        .detail-label {
            color: #64748b;
            font-weight: 500;
        }
        .detail-value {
            color: #0f172a;
            font-weight: 600;
            text-align: right;
        }
        .btn {
            display: inline-block;
            background-color: #0284c7;
            color: #ffffff !important;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 14px;
            margin: 20px 0 8px;
            text-align: center;
        }
        .otp-code {
            font-size: 32px;
            font-weight: 800;
            letter-spacing: 0.25em;
            color: #0284c7;
            text-align: center;
            background-color: #f0f9ff;
            border: 1px dashed #7dd3fc;
            border-radius: 8px;
            padding: 16px;
            margin: 24px 0;
        }
        .footer {
            background-color: #f8fafc;
            border-top: 1px solid #e2e8f0;
            padding: 20px 32px;
            font-size: 12px;
            color: #64748b;
            text-align: center;
            line-height: 1.5;
        }
        .footer p {
            margin: 4px 0;
        }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="header">
                <h1>Dr. Dana E. Roxas Dental Clinic</h1>
                <p>Multi-Branch Dental Excellence & Integrated Patient Care</p>
            </div>
            <div class="content">
                @yield('content')
            </div>
            <div class="footer">
                <p><strong>Dr. Dana E. Roxas Dental Clinic</strong> • Automated Clinic Notifications</p>
                <p>Branches: Quezon City • Makati • Pasig • Alabang</p>
                <p>This is a system-generated transmission. Please contact your treating clinic branch directly for scheduling inquiries.</p>
                <p style="margin-top: 8px; color: #94a3b8;">© {{ date('Y') }} Dr. Dana E. Roxas Dental Clinic. All rights reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>
