/** The bank edition is a separate build: no map, methodology, weights or parcel imagery. */
export const BANK_EDITION = import.meta.env.VITE_BANK_EDITION === "1";

let viewer = "";
/** Who is signed in (bank edition): printed on every report copy. */
export const setViewer = (name: string) => {
  viewer = name;
};
export const getViewer = () => viewer;
