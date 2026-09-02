import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email: string;
  password: string;
  fullName: string;
  role: 'admin' | 'manager' | 'cashier';
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if caller is admin (except for initial setup)
    const authHeader = req.headers.get("Authorization");
    const isInitialSetup = req.headers.get("X-Initial-Setup") === "true";
    
    if (!isInitialSetup && authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user: callerUser } } = await supabaseAdmin.auth.getUser(token);
      
      if (callerUser) {
        const { data: callerRoles } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", callerUser.id);
        
        const isCallerAdmin = callerRoles?.some(r => r.role === "admin");
        if (!isCallerAdmin) {
          return new Response(
            JSON.stringify({ success: false, error: "Only admins can create staff users" }),
            { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }
    }

    const { email, password, fullName, role }: CreateUserRequest = await req.json();

    if (!email || !password || !fullName || !role) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);
    
    if (existingUser) {
      // User exists, check if they have the role
      const { data: existingRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", existingUser.id);
      
      const hasRole = existingRoles?.some(r => r.role === role);
      
      if (!hasRole) {
        // Add the role
        await supabaseAdmin.from("user_roles").insert({
          user_id: existingUser.id,
          role: role,
        });
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "User already exists, role verified",
          userId: existingUser.id 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create new user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      return new Response(
        JSON.stringify({ success: false, error: createError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Assign role
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: newUser.user.id,
      role: role,
    });

    if (roleError) {
      console.error("Error assigning role:", roleError);
      return new Response(
        JSON.stringify({ success: false, error: roleError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`User ${email} created with role ${role}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `User ${email} created with role ${role}`,
        userId: newUser.user.id 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in create-admin-user function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);