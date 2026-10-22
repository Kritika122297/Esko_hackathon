from app.models.brief import BriefState, Question, QuestionOption
from app.services.ai_questions import apply_rewrites, validate_rewrites
from app.services.checks import CheckContext


def _q():
    return Question(id="q:x", issue_ids=["x"], fields=["net_weight"], owner="Legal", priority="must_answer",
                    question="Which net weight is correct?", why="Sheet says 340 g, artwork says 12 oz (340 g).",
                    options=[QuestionOption(id="o1", label="340 g", updates={"net_weight": "340 g"})])


def test_good_rewrite_is_kept_and_options_untouched():
    q = _q()
    data = {"questions": [{"id": "q:x", "question": "Which net weight should go on the pack?",
                           "why": "The sheet says 340 g but the artwork says 12 oz (340 g)."}]}
    rw = validate_rewrites(data, [q])
    saved = CheckContext(question_text=rw)
    apply_rewrites([q], saved)
    assert q.ai_worded and q.original_question == "Which net weight is correct?"
    assert q.options[0].updates == {"net_weight": "340 g"}


def test_rewrite_that_drops_a_number_is_rejected():
    data = {"questions": [{"id": "q:x", "question": "Which weight?", "why": "The values differ."}]}
    assert validate_rewrites(data, [_q()]) == {}


def test_unknown_id_and_junk_are_ignored():
    assert validate_rewrites({"questions": [{"id": "nope", "question": "a", "why": "b"}, "x"]}, [_q()]) == {}
    assert validate_rewrites("garbage", [_q()]) == {}


def test_rewrite_not_applied_when_original_changed():
    q = _q()
    saved = CheckContext(question_text={"q:x": {"orig": "an older question", "question": "n", "why": "w"}})
    apply_rewrites([q], saved)
    assert not q.ai_worded
