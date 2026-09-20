import { createContext, useContext } from 'react'

// "Open the poster file picker", provided by the results screen (which owns the one hidden file input) so any card
// or panel can offer it. Absent outside the results screen; callers then render no link.
export const PosterPickerContext = createContext(null)

/** @returns {(() => void) | null} */
export function useOpenPosterPicker() {
  return useContext(PosterPickerContext)
}
