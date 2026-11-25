// Apple Silicon Macs refuse to open apps with no signature at all ("is damaged and can't be opened").
// Give the app a free ad-hoc signature so the normal right-click > Open route works.
const { execFileSync } = require('child_process'), path = require('path');
exports.default = async function (ctx) {
  if (ctx.electronPlatformName !== 'darwin') return;
  const app = path.join(ctx.appOutDir, ctx.packager.appInfo.productFilename + '.app');
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
};
