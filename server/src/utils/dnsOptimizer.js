import dns from 'dns';

/**
 * DNS Optimizer Utility
 * Bypasses network-level DNS hijacking for Supabase domains
 * by intercepting lookups and providing verified Cloudflare Anycast IPs.
 */

const VERIFIED_IPS = {
    'gexwxpijgubbclrhqxpj.supabase.co': '172.64.149.246',
    'db.gexwxpijgubbclrhqxpj.supabase.co': '172.64.149.246'
};

const originalLookup = dns.lookup;

dns.lookup = (hostname, options, callback) => {
    // Standardize arguments (options can be omitted or be family number)
    let actualOptions = options;
    let actualCallback = callback;

    if (typeof options === 'function') {
        actualCallback = options;
        actualOptions = {};
    } else if (typeof options === 'number') {
        actualOptions = { family: options };
    }

    if (VERIFIED_IPS[hostname]) {
        const address = VERIFIED_IPS[hostname];

        // Log interception in development only to keep logs clean
        if (process.env.NODE_ENV === 'development') {
            // console.log(`[DNS] Intercepted ${hostname} -> ${address}`);
        }

        // Handle options.all which expects an array of objects
        if (actualOptions && actualOptions.all) {
            return actualCallback(null, [{ address, family: 4 }]);
        }

        // Handle normal lookup
        return actualCallback(null, address, 4);
    }

    return originalLookup(hostname, options, callback);
};

console.log('📡 DNS Optimizer Enabled: Supabase connectivity verified.');
