const { evaluateFormula } = require('../src/lib/formula.ts');

console.log("Running Formula Engine Verification Suite...");

const mockContext = {
  properties: {
    "prop-price": 100,
    "prop-qty": 3,
    "prop-tax": "0.15",
    "prop-done": true,
    "prop-status": "In Progress",
    "prop-date1": "2026-09-01",
    "prop-date2": "2026-09-15",
  },
  propNameMap: {
    "Price": "prop-price",
    "Qty": "prop-qty",
    "Tax": "prop-tax",
    "Done": "prop-done",
    "Status": "prop-status",
    "Start": "prop-date1",
    "End": "prop-date2",
  }
};

const testCases = [
  { expr: 'prop("Price") * prop("Qty")', expected: 300 },
  { expr: 'prop("Price") * (1 + prop("Tax"))', expected: 115 },
  { expr: 'if(prop("Done"), "Finished", "Pending")', expected: "Finished" },
  { expr: 'concat("Status: ", prop("Status"))', expected: "Status: In Progress" },
  { expr: 'round(123.456, 2)', expected: 123.46 },
  { expr: 'min(10, 20, 5, 40)', expected: 5 },
  { expr: 'max(10, 20, 5, 40)', expected: 40 },
  { expr: 'dateBetween(prop("End"), prop("Start"), "days")', expected: 14 },
  { expr: 'prop("NonExistent") * 2', expected: 0 },
  { expr: 'window.alert("bad")', expected: "#SECURITY_ERROR!" },
  { expr: '1 / 0', expected: 0 },
];

let passed = 0;
for (const tc of testCases) {
  const res = evaluateFormula(tc.expr, mockContext);
  const ok = res === tc.expected;
  console.log(`${ok ? "✅ PASS" : "❌ FAIL"}: '${tc.expr}' => ${JSON.stringify(res)} (Expected: ${JSON.stringify(tc.expected)})`);
  if (ok) passed++;
}

console.log(`\nResults: ${passed}/${testCases.length} tests passed.`);
if (passed === testCases.length) {
  console.log("All formula tests passed successfully!");
} else {
  process.exit(1);
}
