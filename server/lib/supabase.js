const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Uses the service-role key, which skips row-level security. Server-only (never send this key to
// the client); used for uploading group pictures to Storage, which the anon key isn't allowed to do.
// null when SUPABASE_SERVICE_ROLE_KEY isn't set in server/.env.
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
    : null;

if (!supabaseAdmin) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is not set in server/.env; group picture uploads will fail');
}

module.exports = { supabase, supabaseAdmin };
