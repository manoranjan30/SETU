/**
 * Formats a number according to the Indian Numbering System (Lakhs/Crores).
 * e.g., 100000 -> 1,00,000
 * e.g., 12345678 -> 1,23,45,678
 *
 * @param value The number to format
 * @param decimals Number of decimal places (default 2 for amounts, 3 for quantities usually)
 * @returns Formatted string
 */
export const formatIndianNumber = (
  value: number | string | undefined | null,
  decimals: number = 2,
): string => {
  if (value === undefined || value === null || value === "") return "0";

  const num = Number(value);
  if (isNaN(num)) return "0";

  // Handle decimals
  const fixed = num.toFixed(decimals);
  const [integerPart, decimalPart] = fixed.split(".");

  let lastThree = integerPart.substring(integerPart.length - 3);
  const otherNumbers = integerPart.substring(0, integerPart.length - 3);

  if (otherNumbers !== "") {
    lastThree = "," + lastThree;
  }

  // Regex to insert commas every 2 digits for the rest
  const formattedInteger =
    otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;

  if (decimals > 0) {
    return `${formattedInteger}.${decimalPart}`;
  }
  return formattedInteger;
};
