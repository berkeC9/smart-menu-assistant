"""Pydantic schemas for menu items, allergen metadata, filtering, and AI chat."""

from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Allergen(str, Enum):
    """Supported food allergens tracked by the menu and allergen guard."""

    PEANUT = "peanut"
    TREE_NUT = "tree_nut"
    DAIRY = "dairy"
    GLUTEN = "gluten"
    EGG = "egg"
    SOY = "soy"
    SEAFOOD = "seafood"
    SESAME = "sesame"


class DishCategory(str, Enum):
    """Menu sections used for browsing and filtering dishes."""

    STARTER = "starter"
    SOUP = "soup"
    SALAD = "salad"
    MAIN = "main"
    SIDE = "side"
    DESSERT = "dessert"
    BEVERAGE = "beverage"


class SpiceLevel(str, Enum):
    """Dish spiciness classification."""

    NONE = "none"
    MILD = "mild"
    MEDIUM = "medium"
    HOT = "hot"


_ANIMAL_ALLERGENS = frozenset({Allergen.DAIRY, Allergen.EGG, Allergen.SEAFOOD})


def _normalize_text_list(values: list[str]) -> list[str]:
    """Strip whitespace, remove empty strings, and deduplicate case-insensitively."""
    seen: set[str] = set()
    cleaned: list[str] = []
    for item in values:
        normalized = item.strip()
        if not normalized:
            continue
        key = normalized.lower()
        if key not in seen:
            seen.add(key)
            cleaned.append(normalized)
    return cleaned


def _dedupe_allergens(values: list[Allergen]) -> list[Allergen]:
    """Preserve allergen order while removing duplicates."""
    return list(dict.fromkeys(values))


def _validate_dish_consistency(
    *,
    allergens: list[Allergen],
    may_contain_traces: list[Allergen],
    is_vegan: bool,
    is_vegetarian: bool,
    is_gluten_free: bool,
) -> None:
    """Validate dietary labels against declared allergens and trace warnings."""
    overlap = set(allergens) & set(may_contain_traces)
    if overlap:
        names = ", ".join(sorted(a.value for a in overlap))
        raise ValueError(
            f"Allergens cannot appear in both 'allergens' and 'may_contain_traces': {names}"
        )

    if is_vegan and not is_vegetarian:
        raise ValueError("A vegan dish must also be marked as vegetarian.")

    if is_vegan:
        animal_found = set(allergens) & _ANIMAL_ALLERGENS
        if animal_found:
            names = ", ".join(sorted(a.value for a in animal_found))
            raise ValueError(
                f"A vegan dish cannot list animal-derived allergens: {names}"
            )

    if is_gluten_free and Allergen.GLUTEN in allergens:
        raise ValueError("A gluten-free dish cannot list 'gluten' as an allergen.")


class NutritionFacts(BaseModel):
    """Nutritional breakdown per serving."""

    calories: int = Field(..., ge=0, le=5000)
    protein_g: float = Field(..., ge=0)
    carbs_g: float = Field(..., ge=0)
    fat_g: float = Field(..., ge=0)
    fiber_g: float = Field(default=0.0, ge=0)
    sodium_mg: int = Field(default=0, ge=0)

    model_config = ConfigDict(from_attributes=True)


class DishBase(BaseModel):
    """Shared fields and validation rules for restaurant dishes."""

    name: str = Field(..., min_length=2, max_length=120)
    description: str = Field(..., min_length=10, max_length=500)
    category: DishCategory
    price: float = Field(..., gt=0, le=1000)
    serving_size: Optional[str] = Field(default=None, max_length=50)
    ingredients: list[str] = Field(..., min_length=1)
    allergens: list[Allergen] = Field(default_factory=list)
    may_contain_traces: list[Allergen] = Field(default_factory=list)
    is_vegan: bool = False
    is_vegetarian: bool = False
    is_gluten_free: bool = False
    spice_level: SpiceLevel = SpiceLevel.NONE
    nutrition_facts: NutritionFacts
    is_available: bool = True

    @field_validator("ingredients")
    @classmethod
    def validate_ingredients(cls, value: list[str]) -> list[str]:
        cleaned = _normalize_text_list(value)
        if not cleaned:
            raise ValueError("A dish must include at least one non-empty ingredient.")
        return cleaned

    @field_validator("allergens", "may_contain_traces")
    @classmethod
    def deduplicate_allergen_lists(cls, value: list[Allergen]) -> list[Allergen]:
        return _dedupe_allergens(value)

    @model_validator(mode="after")
    def validate_dietary_and_allergen_rules(self) -> "DishBase":
        _validate_dish_consistency(
            allergens=self.allergens,
            may_contain_traces=self.may_contain_traces,
            is_vegan=self.is_vegan,
            is_vegetarian=self.is_vegetarian,
            is_gluten_free=self.is_gluten_free,
        )
        return self


class DishCreate(DishBase):
    """Payload for creating a new dish."""


class DishUpdate(BaseModel):
    """Payload for partially updating an existing dish."""

    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    description: Optional[str] = Field(default=None, min_length=10, max_length=500)
    category: Optional[DishCategory] = None
    price: Optional[float] = Field(default=None, gt=0, le=1000)
    serving_size: Optional[str] = Field(default=None, max_length=50)
    ingredients: Optional[list[str]] = Field(default=None, min_length=1)
    allergens: Optional[list[Allergen]] = None
    may_contain_traces: Optional[list[Allergen]] = None
    is_vegan: Optional[bool] = None
    is_vegetarian: Optional[bool] = None
    is_gluten_free: Optional[bool] = None
    spice_level: Optional[SpiceLevel] = None
    nutrition_facts: Optional[NutritionFacts] = None
    is_available: Optional[bool] = None

    @field_validator("ingredients")
    @classmethod
    def validate_ingredients(cls, value: Optional[list[str]]) -> Optional[list[str]]:
        if value is None:
            return None
        cleaned = _normalize_text_list(value)
        if not cleaned:
            raise ValueError("Ingredients list cannot be empty when provided.")
        return cleaned

    @field_validator("allergens", "may_contain_traces")
    @classmethod
    def deduplicate_allergen_lists(
        cls, value: Optional[list[Allergen]]
    ) -> Optional[list[Allergen]]:
        if value is None:
            return None
        return _dedupe_allergens(value)


class DishResponse(DishBase):
    """Dish representation returned by menu and chat endpoints."""

    id: int = Field(..., ge=1)

    model_config = ConfigDict(from_attributes=True)


class MenuListResponse(BaseModel):
    """Filtered menu response."""

    total: int = Field(..., ge=0)
    items: list[DishResponse]


class MenuFilterParams(BaseModel):
    """Deterministic safety and preference filters applied to menu queries."""

    search: Optional[str] = Field(default=None, max_length=100)
    category: Optional[DishCategory] = None
    exclude_allergens: list[Allergen] = Field(default_factory=list)
    exclude_traces: bool = True
    diets: list[str] = Field(default_factory=list)
    exclude_ingredients: list[str] = Field(default_factory=list)
    include_ingredients: list[str] = Field(default_factory=list)
    max_calories: Optional[int] = Field(default=None, gt=0)
    max_spice_level: Optional[SpiceLevel] = None
    sort: Optional[str] = Field(default=None, max_length=40)

    @field_validator("exclude_allergens")
    @classmethod
    def deduplicate_excluded_allergens(cls, value: list[Allergen]) -> list[Allergen]:
        return _dedupe_allergens(value)

    @field_validator("diets", "exclude_ingredients", "include_ingredients")
    @classmethod
    def normalize_string_filters(cls, value: list[str]) -> list[str]:
        return _normalize_text_list(value)


class AllergenInfo(BaseModel):
    """Metadata describing a supported allergen for UI badges and filters."""

    code: Allergen
    name: str
    description: str
    keywords: list[str] = Field(default_factory=list)


class AllergenListResponse(BaseModel):
    """List of all supported allergen definitions."""

    count: int = Field(..., ge=0)
    items: list[AllergenInfo]


class ChatMessage(BaseModel):
    """Single conversational turn in chat history."""

    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    """User prompt and safety constraints sent to the AI assistant endpoint."""

    message: str = Field(..., min_length=1, max_length=1000)
    exclude_allergens: list[Allergen] = Field(default_factory=list)
    exclude_traces: bool = True
    diets: list[str] = Field(default_factory=list)
    max_calories: Optional[int] = Field(default=None, gt=0)
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)

    @field_validator("exclude_allergens")
    @classmethod
    def deduplicate_excluded_allergens(cls, value: list[Allergen]) -> list[Allergen]:
        return _dedupe_allergens(value)

    @field_validator("diets")
    @classmethod
    def normalize_diets(cls, value: list[str]) -> list[str]:
        return _normalize_text_list(value)


class ChatResponse(BaseModel):
    """AI assistant reply paired with pre-filtered safe dish recommendations."""

    reply: str
    recommended_dishes: list[DishResponse] = Field(default_factory=list)
    exclude_allergens: list[Allergen] = Field(default_factory=list)
    safe_dish_count: int = Field(..., ge=0)
