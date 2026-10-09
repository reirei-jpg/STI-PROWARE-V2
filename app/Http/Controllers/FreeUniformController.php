<?php

namespace App\Http\Controllers;

use App\Actions\FreeUniforms\GiveRestOfFreeUniform;
use App\Actions\FreeUniforms\RecordFreeUniformGroup;
use App\Http\Requests\FilterFreeUniformsRequest;
use App\Http\Requests\GiveRestOfFreeUniformRequest;
use App\Http\Requests\RecordFreeUniformGroupRequest;
use App\Models\FreeUniformStudent;
use App\Services\FreeUniforms\FreeUniformScreens;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The Specialist's Free Uniforms page (the enrollment promo): students who
 * enroll together in a group each get one uniform set (a blouse or polo and
 * pants) for free. The pieces leave stock as "Free (promo)", never as a
 * sale; pieces out of stock are still to give until they arrive.
 */
class FreeUniformController extends Controller
{
    public function index(FilterFreeUniformsRequest $request): Response
    {
        return Inertia::render('free-uniforms/index', [
            'groups' => FreeUniformScreens::groups($request->search(), $request->show()),
            'summary' => FreeUniformScreens::summary(),
            'sets' => FreeUniformScreens::sets(),
            'products' => FreeUniformScreens::products(),
            'details' => Inertia::optional(fn (): ?array => $request->filled('details') ? FreeUniformScreens::details($request->integer('details')) : null),
            'filters' => [
                'show' => $request->show(),
                'search' => $request->search(),
            ],
            'today' => now()->toDateString(),
        ]);
    }

    public function store(RecordFreeUniformGroupRequest $request, RecordFreeUniformGroup $recordGroup): RedirectResponse
    {
        $result = $recordGroup->handle(
            $request->user(),
            (string) $request->validated('enrolled_on'),
            $request->note(),
            $request->students(),
        );

        $students = count($request->students());
        $message = "Group of {$students} recorded. ".self::givenWords($result['given']).'.';

        if ($result['still_to_give'] !== []) {
            $message .= ' Still to give (out of stock): '.implode('; ', $result['still_to_give']).'. Give them from the group\'s details when they arrive.';
        }

        Inertia::flash('toast', ['type' => $result['still_to_give'] === [] ? 'success' : 'warning', 'message' => $message]);

        return back();
    }

    /**
     * Give a student the pieces of their set that were out of stock.
     */
    public function giveRest(GiveRestOfFreeUniformRequest $request, FreeUniformStudent $student, GiveRestOfFreeUniform $giveRest): RedirectResponse
    {
        $result = $giveRest->handle($student, $request->user(), $request->topVariantId(), $request->pantsVariantId());

        $message = self::givenWords($result['given'])." to {$student->name}.";

        if ($result['still_to_give'] !== []) {
            $message .= ' Still out of stock: '.implode(', ', $result['still_to_give']).'.';
        }

        Inertia::flash('toast', ['type' => $result['still_to_give'] === [] ? 'success' : 'warning', 'message' => $message]);

        return back();
    }

    /**
     * Every student given a free set (matching the search), as a CSV file
     * that opens in Excel.
     */
    public function export(FilterFreeUniformsRequest $request): StreamedResponse
    {
        $rows = FreeUniformScreens::allStudents($request->search());

        return response()->streamDownload(function () use ($rows): void {
            $file = fopen('php://output', 'w');

            if ($file === false) {
                return;
            }

            // Lets Excel read the file as UTF-8 (ñ).
            fwrite($file, "\xEF\xBB\xBF");
            fputcsv($file, ['Group #', 'Date Enrolled', 'Student', 'Enrollment Form #', 'Course / Section', 'Set', 'Top', 'Top Given', 'Pants', 'Pants Given', 'Recorded By'], escape: '');

            foreach ($rows as $row) {
                fputcsv($file, [
                    $row['group_id'],
                    $row['enrolled_on'],
                    $row['name'],
                    $row['enrollment_form_number'],
                    $row['course_section'] ?? '',
                    $row['set_name'],
                    $row['top'],
                    $row['top_given'] ? 'Given' : 'Still to give',
                    $row['pants'],
                    $row['pants_given'] ? 'Given' : 'Still to give',
                    $row['recorded_by'],
                ], escape: '');
            }

            fclose($file);
        }, 'free-uniforms-'.now()->toDateString().'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /** "1 piece given" or "10 pieces given". */
    private static function givenWords(int $pieces): string
    {
        return $pieces === 1 ? '1 piece given' : "{$pieces} pieces given";
    }
}
