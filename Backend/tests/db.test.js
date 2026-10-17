const { getConfig } = require('../src/db');

describe('database configuration', () => {
    const baseEnv = {
        DB_SERVER: '.\\SABAN',
        DB_NAME: 'HelpDesk'
    };

    test('keeps existing Windows authentication as the default', () => {
        expect(getConfig(baseEnv)).toEqual({
            server: '.\\SABAN',
            database: 'HelpDesk',
            options: {
                trustedConnection: true,
                trustServerCertificate: true
            }
        });
    });

    test('configures SQL authentication for the Docker host', () => {
        expect(getConfig({
            ...baseEnv,
            DB_AUTH: 'sql',
            DB_HOST: 'host.docker.internal',
            DB_PORT: '1433',
            DB_USER: 'ithelpdesk_app',
            DB_PASSWORD: 'local-test-password'
        })).toEqual({
            server: 'host.docker.internal',
            database: 'HelpDesk',
            options: {
                trustedConnection: false,
                trustServerCertificate: true
            },
            port: 1433,
            user: 'ithelpdesk_app',
            password: 'local-test-password'
        });
    });

    test.each([
        [{ ...baseEnv, DB_AUTH: 'sql' }, /DB_USER ve DB_PASSWORD/],
        [{ ...baseEnv, DB_AUTH: 'sql', DB_USER: 'app', DB_PASSWORD: 'secret', DB_PORT: 'bad' }, /DB_PORT/],
        [{ ...baseEnv, DB_AUTH: 'unknown' }, /DB_AUTH/],
        [{ DB_AUTH: 'sql', DB_NAME: 'HelpDesk', DB_USER: 'app', DB_PASSWORD: 'secret' }, /DB_SERVER\/DB_HOST/]
    ])('rejects invalid database configuration', (env, message) => {
        expect(() => getConfig(env)).toThrow(message);
    });
});
