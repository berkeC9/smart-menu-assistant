from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/allergens", tags=["allergens"])

SUPPORTED_ALLERGENS: list[dict[str, object]] = [
    {
        "code": "peanut",
        "name": "Peanut",
        "description": "Peanuts, peanut butter, peanut oil, and peanut-based sauces.",
        "keywords": ["peanut", "peanuts", "groundnut", "fistik", "yer fistigi"],
    },
    {
        "code": "tree_nut",
        "name": "Tree Nut",
        "description": "Almonds, walnuts, hazelnuts, cashews, pistachios, and pecans.",
        "keywords": ["tree nut", "almond", "walnut", "hazelnut", "cashew", "pistachio", "ceviz", "findik", "badem"],
    },
    {
        "code": "dairy",
        "name": "Dairy",
        "description": "Milk, cheese, butter, cream, yogurt, and lactose-containing products.",
        "keywords": ["dairy", "milk", "cheese", "butter", "cream", "yogurt", "lactose", "sut", "peynir", "laktoz"],
    },
    {
        "code": "gluten",
        "name": "Gluten",
        "description": "Wheat, barley, rye, regular pasta, bread, and flour-based coatings.",
        "keywords": ["gluten", "wheat", "barley", "rye", "bread", "flour", "celiac", "bugday", "un"],
    },
    {
        "code": "egg",
        "name": "Egg",
        "description": "Whole eggs, egg whites, egg yolks, mayonnaise, and egg-wash batters.",
        "keywords": ["egg", "eggs", "mayonnaise", "mayo", "yumurta"],
    },
    {
        "code": "soy",
        "name": "Soy",
        "description": "Soybeans, soy sauce, tofu, edamame, and soy lecithin.",
        "keywords": ["soy", "soya", "tofu", "edamame", "soy sauce"],
    },
    {
        "code": "seafood",
        "name": "Seafood",
        "description": "Fish, shrimp, crab, lobster, mussels, and seafood stocks.",
        "keywords": ["seafood", "fish", "shrimp", "prawn", "crab", "salmon", "tuna", "shellfish", "balik", "karides"],
    },
    {
        "code": "sesame",
        "name": "Sesame",
        "description": "Sesame seeds, tahini, sesame oil, and sesame-topped buns.",
        "keywords": ["sesame", "tahini", "susam", "tahin"],
    },
]


def get_allergen_map() -> dict[str, dict[str, object]]:
    """Return a dictionary mapping each allergen code to its definition."""
    return {str(item["code"]): item for item in SUPPORTED_ALLERGENS}


@router.get("")
def list_allergens() -> dict[str, object]:
    """Return all supported allergen definitions."""
    return {
        "count": len(SUPPORTED_ALLERGENS),
        "items": SUPPORTED_ALLERGENS,
    }


@router.get("/{allergen_code}")
def get_allergen_detail(allergen_code: str) -> dict[str, object]:
    """Return details for a specific allergen code."""
    normalized = allergen_code.strip().lower()
    allergen_map = get_allergen_map()
    if normalized not in allergen_map:
        raise HTTPException(
            status_code=404,
            detail=f"Allergen '{allergen_code}' is not in the supported list.",
        )
    return allergen_map[normalized]
