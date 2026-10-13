# Génère le schéma d'élicitation avec le code réel de Vibe, puis valide les réponses du pont.
import json, sys
from vibe.acp.agent import _build_elicitation_schema, _elicit_user_answers
from vibe.questions import UserQuestionRequest
req = UserQuestionRequest.model_validate({
    "questions": [
        {"question": "Quel framework de test ?", "header": "Tests", "options": [{"label": "pytest"}, {"label": "unittest"}]},
        {"question": "Quelles cibles ?", "header": "Cibles", "multi_select": True, "options": [{"label": "linux"}, {"label": "macos"}, {"label": "windows"}]},
        {"question": "Nom du module ?", "header": "Nom", "options": [{"label": "core"}, {"label": "utils"}]},
    ],
    "footer_note": "Réponses modifiables plus tard",
})
schema = _build_elicitation_schema(req)
if sys.argv[1] == "schema":
    print(schema.model_dump_json(by_alias=True, exclude_none=True))
else:
    content = json.loads(sys.argv[2])
    for a in _elicit_user_answers(schema, req, content):
        print(json.dumps(a.model_dump(), ensure_ascii=False))
