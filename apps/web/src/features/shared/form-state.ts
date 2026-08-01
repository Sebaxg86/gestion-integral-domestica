export type FormState = {
  message?: string;
  errors?: Record<string, string[]>;
};

export const initialFormState: FormState = {};

export function getFieldErrors(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}) {
  return Object.fromEntries(
    Object.entries(error.flatten().fieldErrors).filter(
      (entry): entry is [string, string[]] => Boolean(entry[1]),
    ),
  );
}
