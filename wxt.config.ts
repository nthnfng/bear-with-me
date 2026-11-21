import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Bear With Me',
    description: 'Barry the bear notices when your tabs drift from your plan, and nudges you back.',
    // tabs: find and close Restricted tabs. alarms: ticks + ICS refresh.
    // scripting: inject into tabs open before install. idle: pause Studying when away.
    permissions: ['tabs', 'storage', 'alarms', 'scripting', 'idle'],
    // Barry has to appear on any Restricted site and fetch the ICS feed.
    host_permissions: ['<all_urls>'],
    web_accessible_resources: [{ resources: ['assets/*'], matches: ['<all_urls>'] }],
  },
});
