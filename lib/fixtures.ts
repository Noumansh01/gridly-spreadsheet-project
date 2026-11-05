import type { Workbook, SheetData, CellMap } from "./type";

function budgetSheet(): SheetData {
  const cells: CellMap = {
    A1: "Q4 OPERATING BUDGET",
    A2: "Department",
    B2: "Line item",
    C2: "October",
    D2: "November",
    E2: "December",
    F2: "Quarter total",
    G2: "Owner",

    A3: "People",
    B3: "Salaries",
    C3: "42000",
    D3: "42000",
    E3: "44000",
    F3: "=SUM(C3:E3)",
    G3: "Finance",

    A4: "People",
    B4: "Contractors",
    C4: "8500",
    D4: "9000",
    E4: "9000",
    F4: "=SUM(C4:E4)",
    G4: "Engineering",

    A5: "People",
    B5: "Training",
    C5: "1200",
    D5: "800",
    E5: "1600",
    F5: "=SUM(C5:E5)",
    G5: "People",

    A6: "People subtotal",
    C6: "=SUM(C3:C5)",
    D6: "=SUM(D3:D5)",
    E6: "=SUM(E3:E5)",
    F6: "=SUM(F3:F5)",

    A8: "Operations",
    B8: "Cloud hosting",
    C8: "3200",
    D8: "3400",
    E8: "3600",
    F8: "=SUM(C8:E8)",
    G8: "Engineering",

    A9: "Operations",
    B9: "Software tools",
    C9: "950",
    D9: "950",
    E9: "1050",
    F9: "=SUM(C9:E9)",

    A10: "Operations",
    B10: "Office",
    C10: "1800",
    D10: "1800",
    E10: "1800",
    F10: "=SUM(C10:E10)",

    A11: "Operations subtotal",
    C11: "=SUM(C8:C10)",
    D11: "=SUM(D8:D10)",
    E11: "=SUM(E8:E10)",
    F11: "=SUM(F8:F10)",

    A13: "Growth",
    B13: "Campaigns",
    C13: "4500",
    D13: "5200",
    E13: "6100",
    F13: "=SUM(C13:E13)",

    A14: "Growth",
    B14: "Events",
    C14: "1200",
    D14: "900",
    E14: "1800",
    F14: "=SUM(C14:E14)",

    A15: "Growth subtotal",
    C15: "=SUM(C13:C14)",
    D15: "=SUM(D13:D14)",
    E15: "=SUM(E13:E14)",
    F15: "=SUM(F13:F14)",

    A17: "TOTAL OPERATING COST",
    C17: "=C6+C11+C15",
    D17: "=D6+D11+D15",
    E17: "=E6+E11+E15",
    F17: "=F6+F11+F15",

    A19: "Forecast",
    B19: "Contingency (8%)",
    C19: "=C17*0.08",
    D19: "=D17*0.08",
    E19: "=E17*0.08",
    F19: "=SUM(C19:E19)",

    A20: "Forecast",
    B20: "Grand total",
    C20: "=C17+C19",
    D20: "=D17+D19",
    E20: "=E17+E19",
    F20: "=F17+F19",

    F22: "=F20",
    F23: "=F22",
    F24: "=F23",
  };

  return {
    id: "budget",
    name: "Budget",
    rows: 100,
    columns: 12,
    cells,
  };
}

function bigSheet(): SheetData {
  const cells: CellMap = {
    A1: "Order ID",
    B1: "Customer",
    C1: "Region",
    D1: "Units",
    E1: "Unit price",
    F1: "Discount",
    G1: "Subtotal",
    H1: "Tax",
    I1: "Total",
    J1: "Status",
    K1: "Sales rep",
    L1: "Margin",
  };

  for (let row = 2; row <= 10001; row++) {
    cells[`A${row}`] = `ORD-${String(row - 1).padStart(5, "0")}`;

    cells[`B${row}`] = `Customer ${((row - 2) % 37) + 1}`;

    cells[`C${row}`] = ["North", "South", "East", "West"][(row - 2) % 4];

    cells[`D${row}`] = String(((row * 7) % 18) + 1);
    cells[`E${row}`] = String(15 + ((row * 13) % 85));
    cells[`F${row}`] = String(((row * 3) % 12) / 100);

    cells[`G${row}`] = `=D${row}*E${row}*(1-F${row})`;
    cells[`H${row}`] = `=G${row}*0.05`;
    cells[`I${row}`] = `=G${row}+H${row}`;

    cells[`J${row}`] = ["Paid", "Pending", "Shipped"][(row - 2) % 3];

    cells[`K${row}`] = `Rep ${((row - 2) % 8) + 1}`;
    cells[`L${row}`] = `=G${row}*0.22`;
  }

  cells["I10002"] = "=SUM(I2:I10001)";

  return {
    id: "large",
    name: "10k Orders",
    rows: 10002,
    columns: 12,
    cells,
  };
}

function brokenSheet(): SheetData {
  return {
    id: "broken",
    name: "Formula Lab",
    rows: 100,
    columns: 8,
    cells: {
      A1: "Broken formula examples",

      A2: "Cycle A",
      B2: "=C2",
      C2: "=B2",

      A4: "Missing reference",
      B4: "=Z99999+10",

      A6: "Division by zero",
      B6: "=10/0",

      A8: "Depends on broken",
      B8: "=B6+5",

      A10: "Valid formula",
      B10: "=SUM(2,3,4)",

      A12: "Average",
      B12: "=AVG(10,20,30)",
    },
  };
}

export function createFixtures(): Workbook {
  return {
    sheets: [budgetSheet(), bigSheet(), brokenSheet()],
  };
}
