// `npm run contrast`: the lowest ratios of every built-in preset and scheme.
import { BUILTINS } from '../src/client/lib/builtins.ts';
import { SCHEMES, contrastReport } from '../src/client/lib/palette.ts';

let failed = 0;
for (const [id, preset] of Object.entries(BUILTINS)) {
    for (const scheme of SCHEMES) {
        const rows = contrastReport(preset[scheme], scheme);
        const low = (min: number) => Math.min(...rows.filter((r) => r.min === min).map((r) => r.ratio)).toFixed(2);
        const bad = rows.filter((r) => r.ratio < r.min);
        failed += bad.length;
        console.log(`${`${id} ${scheme}`.padEnd(18)} lowest text ${low(4.5)}  lowest fill ${low(3)}  ${bad.length ? 'FAIL: ' + bad.map((r) => `${r.label} ${r.ratio.toFixed(2)}`).join(', ') : 'ok'}`);
    }
}
process.exitCode = failed ? 1 : 0;
