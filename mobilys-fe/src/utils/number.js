export function num(n) {
  if (n === null || n === undefined) return "-";
  const x = Number(n);
  if (Number.isNaN(x)) return "-";
  return x.toLocaleString();
}

export function num1(n) {
  if (n === null || n === undefined) return "-";
  const x = Number(n);
  if (Number.isNaN(x)) return "-";
  return x.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
