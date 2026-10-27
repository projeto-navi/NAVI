// Suíte de caracterização de COMPORTAMENTO do Navi.
// Os testes usam papel e nome acessível (getByRole), não classes CSS, para valerem
// antes e depois da troca de identidade visual e da divisão em duas páginas.
const { defineConfig, devices } = require('@playwright/test');

const PORTA = Number(process.env.PORTA || 4173);

module.exports = defineConfig({
  testDir: 'testes',
  testMatch: /.*\.spec\.js$/,
  timeout: 45_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'testes/relatorio' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORTA}/`,
    locale: 'pt-BR',
    trace: 'retain-on-failure',
    // WebGL por software, para o 3D e a primeira pessoa rodarem sem placa de vídeo
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }
  },
  webServer: {
    command: `node testes/servidor.mjs site-acessivel ${PORTA}`,
    url: `http://127.0.0.1:${PORTA}/`,
    reuseExistingServer: !process.env.CI
  },
  projects: [
    { name: 'dados', testMatch: /dados\/.*\.spec\.js$/ },
    {
      name: 'celular',
      testMatch: /comportamento\/.*\.spec\.js$/,
      use: { ...devices['Pixel 5'], viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 }
    },
    {
      name: 'computador',
      testMatch: /comportamento\/.*\.spec\.js$/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
    }
  ]
});
