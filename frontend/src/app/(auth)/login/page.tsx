'use client';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { signIn } from '@/lib/auth';
import { loginSchema, type LoginInput } from '@/lib/validations';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Lock, Mail, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

/**
 * Login Page - Modern split layout with social login
 */
export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);

    try {
      const result = await signIn.email({
        email: data.email,
        password: data.password,
      });

      if (result.error) {
        toast.error('Login failed', {
          description: result.error.message || 'Invalid email or password',
        });
      } else {
        toast.success('Welcome back!', {
          description: 'Successfully signed in',
        });
        // Use hard redirect to ensure session cookies are properly recognized
        window.location.href = '/organizations';
      }
    } catch (err) {
      console.error('Login error:', err);
      toast.error('An unexpected error occurred', {
        description: 'Please try again later',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'microsoft') => {
    setSocialLoading(provider);
    try {
      await signIn.social({
        provider,
        callbackURL: '/organizations',
      });
    } catch (err) {
      console.error(`${provider} login error:`, err);
      toast.error(`Failed to sign in with ${provider}`, {
        description: 'Please try again',
      });
      setSocialLoading(null);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Side - Branding/Illustration */}
      <div className="hidden lg:flex flex-col justify-between bg-primary p-10 text-primary-foreground">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-foreground/10">
            <Users className="h-5 w-5" />
          </div>
          <span className="text-xl font-semibold">Network CRM</span>
        </div>

        <div className="space-y-6">
          <blockquote className="space-y-2">
            <p className="text-lg">
              "This CRM has transformed how I manage my professional
              relationships. The AI-powered insights help me stay connected with
              the right people at the right time."
            </p>
            <footer className="text-sm opacity-80">Sofia Davis, CEO</footer>
          </blockquote>
        </div>

        <div className="text-sm opacity-60">
          © {new Date().getFullYear()} Personal Network CRM
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 lg:p-6">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Users className="h-4 w-4" />
            </div>
            <span className="font-semibold">Network CRM</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link href="/register">
              <Button variant="ghost">Sign up</Button>
            </Link>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 flex items-center justify-center p-4 lg:p-8">
          <Card className="w-full max-w-md border-0 shadow-none lg:border lg:shadow-sm">
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
              <CardDescription>
                Sign in to your account to continue
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Social Login Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() => handleSocialLogin('google')}
                  disabled={!!socialLoading || isLoading}
                  className="w-full"
                >
                  {socialLoading === 'google' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  )}
                  Google
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSocialLogin('microsoft')}
                  disabled={!!socialLoading || isLoading}
                  className="w-full"
                >
                  {socialLoading === 'microsoft' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <path fill="#f25022" d="M1 1h10v10H1z" />
                      <path fill="#00a4ef" d="M1 13h10v10H1z" />
                      <path fill="#7fba00" d="M13 1h10v10H13z" />
                      <path fill="#ffb900" d="M13 13h10v10H13z" />
                    </svg>
                  )}
                  Microsoft
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Or continue with email
                  </span>
                </div>
              </div>

              {/* Email Login Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      {...register('email')}
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-9"
                      disabled={isLoading || !!socialLoading}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-destructive">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      href="/forgot-password"
                      className="text-sm text-primary hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      {...register('password')}
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-9"
                      disabled={isLoading || !!socialLoading}
                    />
                  </div>
                  {errors.password && (
                    <p className="text-sm text-destructive">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !!socialLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Signing in...
                    </>
                  ) : (
                    'Sign in'
                  )}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground">
                Don't have an account?{' '}
                <Link
                  href="/register"
                  className="text-primary hover:underline font-medium"
                >
                  Sign up
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
