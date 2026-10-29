<?php

namespace Tests\Feature\Assistant;

use App\Http\Controllers\GeminiChatController;
use App\Models\Branch;
use App\Models\Service;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;
use Tests\Feature\Appointments\SchedulingFixture;

class GeminiChatTest extends TestCase
{
    use RefreshDatabase, SchedulingFixture;

    private const FAKE_KEY = 'test-gemini-api-key-12345';

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSchedulingWorld();
        $this->actingAsUser('patientA');
        Config::set('services.gemini.api_key', self::FAKE_KEY);
        Config::set('services.gemini.model', 'gemini-1.5-flash');
    }

    public function test_gemini_chat_returns_generated_response(): void
    {
        Http::fake([
            'https://generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                ['text' => 'Hello! We offer general cleaning, tooth extraction, and orthodontic braces at Dr. Dana E. Roxas Dental Clinic.'],
                            ],
                            'role' => 'model',
                        ],
                        'finishReason' => 'STOP',
                    ],
                ],
            ], 200),
        ]);

        $response = $this->postJson('/api/gemini/chat', [
            'message' => 'What services do you offer?',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.outcome', 'answered')
            ->assertJsonPath('data.mode', 'gemini')
            ->assertJsonPath('data.answer', 'Hello! We offer general cleaning, tooth extraction, and orthodontic braces at Dr. Dana E. Roxas Dental Clinic.');
    }

    public function test_gemini_chat_refuses_medical_diagnosis_with_disclaimer(): void
    {
        $response = $this->postJson('/api/gemini/chat', [
            'message' => 'Do I have a cavity or infection? What antibiotic medicine dosage should I take?',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.outcome', 'refused_medical')
            ->assertJsonPath('data.mode', 'guard');

        $this->assertStringContainsString('Medical Disclaimer', $response->json('data.answer'));
        $this->assertStringContainsString('cannot provide dental or medical diagnosis', $response->json('data.answer'));
    }

    public function test_gemini_chat_screens_emergency_symptoms(): void
    {
        $response = $this->postJson('/api/gemini/chat', [
            'message' => 'I have severe unbearable pain and heavy bleeding that will not stop!',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.outcome', 'emergency')
            ->assertJsonPath('data.mode', 'guard');

        $this->assertStringContainsString('urgent dental condition', $response->json('data.answer'));
        $this->assertStringContainsString('emergency', $response->json('data.answer'));
    }

    public function test_gemini_chat_rate_limit_backoff_and_fallback(): void
    {
        // Simulate Gemini API HTTP 429 Rate Limit
        Http::fake([
            'https://generativelanguage.googleapis.com/*' => Http::response(['error' => 'Resource Exhausted / Rate limit'], 429),
        ]);

        // Seed a clinic knowledge answer
        DB::table('assistant_answers')->insert([
            'public_id' => '01JBKQ1234567890ABCDEFGH11',
            'question' => 'What are your clinic hours?',
            'keywords' => json_encode(['hours', 'open']),
            'category' => 'hours',
            'answer' => 'Our branches are open Monday to Saturday from 9:00 AM to 5:00 PM.',
            'active' => true,
            'draft' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->postJson('/api/gemini/chat', [
            'message' => 'What are your clinic hours?',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.mode', 'knowledge_fallback');

        $this->assertStringContainsString('Our AI assistant is currently experiencing high demand', $response->json('data.answer'));
        $this->assertStringContainsString('Our branches are open Monday to Saturday', $response->json('data.answer'));
    }

    public function test_gemini_chat_missing_api_key_falls_back(): void
    {
        Config::set('services.gemini.api_key', '');

        $response = $this->postJson('/api/gemini/chat', [
            'message' => 'Hello, can you help me?',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.mode', 'knowledge_fallback');

        $this->assertStringContainsString('Dr. Dana E. Roxas Dental Clinic', $response->json('data.answer'));
    }

    public function test_gemini_stream_returns_sse_stream(): void
    {
        Http::fake([
            'https://generativelanguage.googleapis.com/*' => Http::response(
                "data: {\"candidates\": [{\"content\": {\"parts\": [{\"text\": \"Welcome to \"}]}}]}\n\n" .
                "data: {\"candidates\": [{\"content\": {\"parts\": [{\"text\": \"our clinic!\"}]}}]}\n\n",
                200,
                ['Content-Type' => 'text/event-stream']
            ),
        ]);

        $response = $this->post('/api/gemini/stream', [
            'message' => 'Tell me about the clinic',
        ]);

        $response->assertOk();
        $this->assertStringContainsString('text/event-stream', $response->headers->get('Content-Type'));
    }

    public function test_gemini_system_prompt_grounded_in_clinic_facts(): void
    {
        $controller = new GeminiChatController();
        $prompt = $controller->buildSystemPrompt();

        $this->assertStringContainsString('Dr. Dana E. Roxas Dental Clinic', $prompt);
        $this->assertStringContainsString('Full refund if cancelled 24+ hours before', $prompt);
        $this->assertStringContainsString('PayMongo', $prompt);
        $this->assertStringContainsString('NEVER PROVIDE MEDICAL OR DENTAL DIAGNOSES', $prompt);
        $this->assertStringContainsString('Medical Disclaimer', $prompt);
    }
}
