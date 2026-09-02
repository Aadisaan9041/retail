import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Voice assistant tools configuration
const getVoiceAssistantTools = () => [
  {
    type: "function",
    name: "navigate_to_view",
    description: "Navigate to a different view in the admin panel",
    parameters: {
      type: "object",
      properties: {
        view: {
          type: "string",
          enum: ["dashboard", "pos", "products", "transactions", "customers", "reorders", "reports", "settings"],
          description: "The view to navigate to"
        }
      },
      required: ["view"]
    }
  },
  {
    type: "function",
    name: "get_dashboard_metrics",
    description: "Get current dashboard metrics including today's sales, transactions, low stock items",
    parameters: { type: "object", properties: {}, required: [] }
  },
  {
    type: "function",
    name: "search_products",
    description: "Search for products by name or category",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query for product name" },
        category: { type: "string", description: "Filter by category name" }
      },
      required: []
    }
  },
  {
    type: "function",
    name: "get_low_stock_products",
    description: "Get list of products that are low on stock",
    parameters: { type: "object", properties: {}, required: [] }
  },
  {
    type: "function",
    name: "search_customers",
    description: "Search for customers by name, email, or phone",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query for customer name, email or phone" }
      },
      required: ["query"]
    }
  },
  {
    type: "function",
    name: "get_recent_transactions",
    description: "Get recent transactions, optionally filtered by date",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of transactions to return (default 5)" }
      },
      required: []
    }
  },
  {
    type: "function",
    name: "add_product_to_cart",
    description: "Add a product to the current POS cart",
    parameters: {
      type: "object",
      properties: {
        product_name: { type: "string", description: "Name of the product to add" },
        quantity: { type: "number", description: "Quantity to add (default 1)" }
      },
      required: ["product_name"]
    }
  },
  {
    type: "function",
    name: "clear_cart",
    description: "Clear all items from the current POS cart",
    parameters: { type: "object", properties: {}, required: [] }
  },
  {
    type: "function",
    name: "process_checkout",
    description: "Process checkout with specified payment method",
    parameters: {
      type: "object",
      properties: {
        payment_method: {
          type: "string",
          enum: ["cash", "card"],
          description: "Payment method to use"
        }
      },
      required: ["payment_method"]
    }
  },
  {
    type: "function",
    name: "get_sales_report",
    description: "Get sales report for today or a specific period",
    parameters: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["today", "week", "month"],
          description: "Time period for the report"
        }
      },
      required: []
    }
  },
  {
    type: "function",
    name: "update_product_price",
    description: "Update the price of a product",
    parameters: {
      type: "object",
      properties: {
        product_name: { type: "string", description: "Name of the product to update" },
        new_price: { type: "number", description: "New price for the product" }
      },
      required: ["product_name", "new_price"]
    }
  },
  {
    type: "function",
    name: "create_reorder_request",
    description: "Create a reorder request for a product that needs restocking",
    parameters: {
      type: "object",
      properties: {
        product_name: { type: "string", description: "Name of the product to reorder" },
        quantity: { type: "number", description: "Quantity to reorder" }
      },
      required: ["product_name"]
    }
  },
  {
    type: "function",
    name: "update_product_quantity",
    description: "Update the stock quantity of a product",
    parameters: {
      type: "object",
      properties: {
        product_name: { type: "string", description: "Name of the product" },
        quantity: { type: "number", description: "New stock quantity" }
      },
      required: ["product_name", "quantity"]
    }
  }
];

const getVoiceAssistantInstructions = () => `You are a helpful voice assistant for a retail POS (Point of Sale) system. You help admin users manage their store through voice commands.

You can help with:
- PRODUCTS: Add new products, update prices, check stock levels, mark items as low stock
- TRANSACTIONS: View recent sales, process refunds, check daily totals
- CUSTOMERS: Look up customer information, check loyalty points
- REPORTS: Get sales summaries, best selling products, revenue reports
- NAVIGATION: Switch between different views like dashboard, POS, products, transactions, customers, reports, settings

You understand and respond in English, Hindi, and Hinglish (a mix of Hindi and English). Adapt your language based on how the user speaks to you.

When the user asks you to perform an action, call the appropriate function. Be helpful, concise, and confirm actions before executing them.

Some example commands you should understand:
- "Show me today's sales" / "Aaj ki sales dikhao"
- "Add a new product" / "Naya product add karo"
- "Go to dashboard" / "Dashboard pe jao"
- "Check low stock items" / "Low stock items check karo"
- "Find customer John" / "Customer John ko dhundo"`;

// Authenticate user and check for staff role
async function authenticateUser(authHeader: string | null): Promise<{ userId: string; role: string } | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    console.log('No valid auth header provided');
    return null;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const token = authHeader.replace('Bearer ', '');
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  
  if (claimsError || !claimsData?.claims) {
    console.error('Failed to verify token:', claimsError);
    return null;
  }

  const userId = claimsData.claims.sub as string;
  
  // Check if user has staff role (admin, manager, or cashier)
  const { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single();

  if (roleError || !roleData) {
    console.log('User has no staff role');
    return null;
  }

  const validRoles = ['admin', 'manager', 'cashier'];
  if (!validRoles.includes(roleData.role)) {
    console.log('Invalid role:', roleData.role);
    return null;
  }

  console.log(`User ${userId} authenticated with role: ${roleData.role}`);
  return { userId, role: roleData.role };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  const url = new URL(req.url);
  const upgrade = req.headers.get("upgrade") || "";

  // WebSocket upgrade request
  if (upgrade.toLowerCase() === "websocket") {
    // For WebSocket, we need to authenticate before upgrading
    const user = await authenticateUser(authHeader);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized - Staff access required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);
    
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not set');
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let openaiSocket: WebSocket | null = null;

    clientSocket.onopen = () => {
      console.log(`Client connected to voice assistant (user: ${user.userId}, role: ${user.role})`);
      
      // Connect to OpenAI Realtime API
      openaiSocket = new WebSocket(
        'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
        ['realtime', `openai-insecure-api-key.${OPENAI_API_KEY}`, 'openai-beta.realtime-v1']
      );

      openaiSocket.onopen = () => {
        console.log('Connected to OpenAI Realtime API');
        clientSocket.send(JSON.stringify({ type: 'connected', role: user.role }));
      };

      openaiSocket.onmessage = (event) => {
        try {
          clientSocket.send(event.data);
        } catch (e) {
          console.error('Error forwarding OpenAI message:', e);
        }
      };

      openaiSocket.onerror = (error) => {
        console.error('OpenAI WebSocket error:', error);
        clientSocket.send(JSON.stringify({ type: 'error', message: 'OpenAI connection error' }));
      };

      openaiSocket.onclose = (event) => {
        console.log('OpenAI WebSocket closed:', event.code, event.reason);
        clientSocket.send(JSON.stringify({ type: 'openai_disconnected' }));
      };
    };

    clientSocket.onmessage = (event) => {
      if (openaiSocket && openaiSocket.readyState === WebSocket.OPEN) {
        openaiSocket.send(event.data);
      }
    };

    clientSocket.onerror = (error) => {
      console.error('Client WebSocket error:', error);
    };

    clientSocket.onclose = () => {
      console.log('Client disconnected');
      if (openaiSocket) {
        openaiSocket.close();
      }
    };

    return response;
  }

  // Non-WebSocket request - return session token for WebRTC approach
  try {
    // Authenticate user for HTTP requests
    const user = await authenticateUser(authHeader);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized - Staff access required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const { action } = await req.json().catch(() => ({ action: 'get_token' }));

    if (action === 'get_token') {
      console.log(`Creating session for user ${user.userId} with role ${user.role}`);
      
      // Request an ephemeral token from OpenAI for WebRTC connection
      const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview-2024-12-17",
          voice: "alloy",
          instructions: getVoiceAssistantInstructions(),
          input_audio_transcription: {
            model: "whisper-1"
          },
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 800
          },
          tools: getVoiceAssistantTools(),
          tool_choice: "auto"
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI session error:", errorText);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      console.log("Session created successfully for user:", user.userId);
      
      return new Response(JSON.stringify({ ...data, userRole: user.role }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
