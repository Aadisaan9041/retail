import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Mail, Lock, User, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useStoreName } from '@/hooks/useStoreName';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Enhanced validation schemas with comprehensive security rules
const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .max(254, 'Email must be less than 254 characters')
  .refine(
    (email) => !email.includes('..') && !email.startsWith('.') && !email.endsWith('.'),
    'Invalid email format'
  );

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be less than 72 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character');

const nameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be less than 100 characters')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes');

// Login schema (less strict password for existing users)
const loginPasswordSchema = z
  .string()
  .min(1, 'Password is required')
  .max(72, 'Password must be less than 72 characters');

// Combined schemas for form validation
const loginSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
});

const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: nameSchema,
});

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  
  const { user, isLoading, primaryRole, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const { storeName } = useStoreName();
  const navigate = useNavigate();

  // Role-based redirect after login
  useEffect(() => {
    if (user && primaryRole && !isLoading) {
      switch (primaryRole) {
        case 'admin':
          navigate('/admin', { replace: true });
          break;
        case 'manager':
          navigate('/manager', { replace: true });
          break;
        case 'cashier':
          navigate('/admin', { replace: true });
          break;
        case 'customer':
          navigate('/customer', { replace: true });
          break;
        default:
          navigate('/', { replace: true });
      }
    }
  }, [user, primaryRole, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user && primaryRole) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const validate = () => {
    setFormError(null);
    
    try {
      if (isLogin) {
        const result = loginSchema.safeParse({ email, password });
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach((err) => {
            const field = err.path[0] as string;
            if (!fieldErrors[field]) {
              fieldErrors[field] = err.message;
            }
          });
          setErrors(fieldErrors);
          return false;
        }
      } else {
        const result = signupSchema.safeParse({ email, password, fullName });
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach((err) => {
            const field = err.path[0] as string;
            if (!fieldErrors[field]) {
              fieldErrors[field] = err.message;
            }
          });
          setErrors(fieldErrors);
          return false;
        }
      }
      
      setErrors({});
      return true;
    } catch {
      setFormError('Validation error occurred');
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setIsSubmitting(true);
    
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            title: 'Login Failed',
            description: error.message,
            variant: 'destructive',
          });
        }
        // Role-based redirect is handled by useEffect
      } else {
        // Customer-only signup
        const { error } = await signUp(email, password, fullName);
        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              title: 'Account Exists',
              description: 'This email is already registered. Please sign in instead.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Sign Up Failed',
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          // Auto-assign customer role after signup
          const { data: { user: newUser } } = await supabase.auth.getUser();
          if (newUser) {
            // Use type assertion since 'customer' is newly added
            await supabase.from('user_roles').insert([{
              user_id: newUser.id,
              role: 'customer' as any
            }]);
          }
          
          toast({
            title: 'Account Created',
            description: 'Welcome! Your customer account is ready.',
          });
          
          // Redirect to customer dashboard
          navigate('/customer', { replace: true });
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/20 to-primary/5 items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-8">
            <ShoppingCart className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold mb-4">{storeName}</h1>
          <p className="text-lg text-muted-foreground">
            Professional point-of-sale system with inventory management, 
            customer loyalty programs, and real-time analytics.
          </p>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold">{storeName}</h1>
          </div>

          <div className="glass-card rounded-2xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
              <p className="text-muted-foreground mt-2">
                {isLogin ? 'Sign in to access the POS system' : 'Register for a new account'}
              </p>
            </div>

            {formError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10 input-retail"
                      autoComplete="name"
                    />
                  </div>
                  {errors.fullName && (
                    <p className="text-sm text-destructive">{errors.fullName}</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 input-retail"
                    autoComplete="email"
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 input-retail"
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                  />
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
                {!isLogin && !errors.password && (
                  <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                    <li className={password.length >= 8 ? 'text-green-600' : ''}>
                      • At least 8 characters
                    </li>
                    <li className={/[a-z]/.test(password) ? 'text-green-600' : ''}>
                      • One lowercase letter
                    </li>
                    <li className={/[A-Z]/.test(password) ? 'text-green-600' : ''}>
                      • One uppercase letter
                    </li>
                    <li className={/[0-9]/.test(password) ? 'text-green-600' : ''}>
                      • One number
                    </li>
                    <li className={/[^a-zA-Z0-9]/.test(password) ? 'text-green-600' : ''}>
                      • One special character
                    </li>
                  </ul>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isLogin ? (
                  'Sign In'
                ) : (
                  'Create Account'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrors({});
                  setFormError(null);
                }}
                className="text-primary hover:underline"
              >
                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Contact your administrator to get access credentials.
          </p>
        </div>
      </div>
    </div>
  );
}
