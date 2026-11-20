import { mergeDrinks, type Category, type Drink, type RawDrink, type SortKey } from "./lib/drinks.ts";

export type Screen = "home" | "camera" | "results";
export type PhotoStatus = "queued" | "scanning" | "done" | "error";

export interface Photo {
  id: string;
  thumb: string;
  status: PhotoStatus;
  found: number;
  warning?: string;
  error?: string;
  canRetry?: boolean;
  createdAt: number;
}

export interface AppState {
  screen: Screen;
  drinks: Drink[];
  photos: Photo[];
  sort: SortKey;
  filter: Category | "all";
  editingId: string | null;
}

export type Action =
  | { type: "screen"; screen: Screen }
  | { type: "addPhoto"; photo: Photo }
  | { type: "removePhoto"; id: string }
  | { type: "photoStatus"; id: string; status: PhotoStatus; error?: string; canRetry?: boolean }
  | { type: "drinkFound"; photoId: string; drink: RawDrink }
  | { type: "photoDone"; id: string; warning: string }
  | { type: "updateDrink"; id: string; patch: Partial<RawDrink> }
  | { type: "removeDrink"; id: string }
  | { type: "sort"; sort: SortKey }
  | { type: "filter"; filter: Category | "all" }
  | { type: "edit"; id: string | null }
  | { type: "reset" };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "screen":
      return { ...state, screen: action.screen };
    case "addPhoto":
      return { ...state, photos: [...state.photos, action.photo] };
    case "removePhoto": {
      const drinks = state.drinks
        .map((d) => (d.photoIds.includes(action.id) ? { ...d, photoIds: d.photoIds.filter((p) => p !== action.id) } : d))
        .filter((d) => d.photoIds.length > 0 || d.edited);
      return { ...state, photos: state.photos.filter((p) => p.id !== action.id), drinks };
    }
    case "photoStatus":
      return {
        ...state,
        photos: state.photos.map((p) =>
          p.id === action.id ? { ...p, status: action.status, error: action.error, canRetry: action.canRetry } : p,
        ),
      };
    case "drinkFound": {
      const drinks = mergeDrinks(state.drinks, [action.drink], action.photoId);
      return {
        ...state,
        drinks,
        photos: state.photos.map((p) => (p.id === action.photoId ? { ...p, found: p.found + 1 } : p)),
      };
    }
    case "photoDone":
      return {
        ...state,
        photos: state.photos.map((p) =>
          p.id === action.id ? { ...p, status: "done", warning: action.warning || undefined, error: undefined } : p,
        ),
      };
    case "updateDrink":
      return {
        ...state,
        drinks: state.drinks.map((d) =>
          d.id === action.id
            ? {
                ...d,
                ...action.patch,
                edited: true,
                volumeSource: action.patch.volumeMl !== undefined ? "menu" : d.volumeSource,
                abvSource: action.patch.abv !== undefined ? "menu" : d.abvSource,
              }
            : d,
        ),
      };
    case "removeDrink":
      return {
        ...state,
        drinks: state.drinks.filter((d) => d.id !== action.id),
        editingId: state.editingId === action.id ? null : state.editingId,
      };
    case "sort":
      return { ...state, sort: action.sort };
    case "filter":
      return { ...state, filter: action.filter };
    case "edit":
      return { ...state, editingId: action.id };
    case "reset":
      return { ...state, drinks: [], photos: [], filter: "all", editingId: null, screen: "home" };
  }
}
