import { createContext, useContext } from "react";
import { DEFAULT_PROFILE, type Profile } from "./lib/drinks.ts";

export const ProfileContext = createContext<Profile>(DEFAULT_PROFILE);

/** The weight and sex the promille numbers are calculated for. */
export const useProfile = () => useContext(ProfileContext);
