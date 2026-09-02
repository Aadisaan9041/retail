import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX, X, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ViewType } from '@/types/retail';
import { useAuth } from '@/contexts/AuthContext';

interface VoiceAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: ViewType) => void;
  onAction: (action: string, params: Record<string, unknown>) => Promise<unknown>;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function VoiceAssistant({ isOpen, onClose, onNavigate, onAction }: VoiceAssistantProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [partialTranscript, setPartialTranscript] = useState('');
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, partialTranscript]);

  const handleFunctionCall = useCallback(async (functionName: string, args: Record<string, unknown>) => {
    console.log('Function call:', functionName, args);
    
    try {
      switch (functionName) {
        case 'navigate_to_view':
          onNavigate(args.view as ViewType);
          return { success: true, message: `Navigated to ${args.view}` };
        
        case 'get_dashboard_metrics':
          return await onAction('get_metrics', {});
        
        case 'search_products':
          return await onAction('search_products', args);
        
        case 'get_low_stock_products':
          return await onAction('get_low_stock', {});
        
        case 'search_customers':
          return await onAction('search_customers', args);
        
        case 'get_recent_transactions':
          return await onAction('get_transactions', { limit: args.limit || 5 });
        
        case 'add_product_to_cart':
          return await onAction('add_to_cart', args);
        
        case 'clear_cart':
          return await onAction('clear_cart', {});
        
        case 'process_checkout':
          return await onAction('checkout', args);
        
        case 'get_sales_report':
          return await onAction('get_report', args);
        
        case 'update_product_price':
          return await onAction('update_price', args);
        
        case 'create_reorder_request':
          return await onAction('create_reorder', args);
        
        case 'update_product_quantity':
          return await onAction('update_stock', args);
        
        default:
          return { error: 'Unknown function' };
      }
    } catch (error) {
      console.error('Function call error:', error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, [onNavigate, onAction]);

  const startConversation = useCallback(async () => {
    // Check authentication first
    if (!session?.access_token) {
      toast({
        title: 'Authentication Required',
        description: 'You must be logged in to use the voice assistant',
        variant: 'destructive'
      });
      return;
    }
    
    setIsConnecting(true);
    
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      // Get ephemeral token from edge function with auth
      const { data, error } = await supabase.functions.invoke('voice-assistant', {
        body: { action: 'get_token' },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      
      if (error || !data?.client_secret?.value) {
        throw new Error(error?.message || 'Failed to get session token. Ensure you have staff access.');
      }
      
      const EPHEMERAL_KEY = data.client_secret.value;
      
      // Create peer connection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      
      // Create audio element for playback
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioElRef.current = audioEl;
      
      // Set up remote audio
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };
      
      // Add local audio track
      pc.addTrack(stream.getTracks()[0]);
      
      // Set up data channel
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      
      dc.addEventListener('open', () => {
        console.log('Data channel open');
        setIsConnected(true);
        setIsConnecting(false);
        setIsListening(true);
        
        // Send initial greeting
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: 'Hello! I\'m your voice assistant. How can I help you manage the store today? Aap Hindi mein bhi baat kar sakte hain!',
          timestamp: new Date()
        }]);
      });
      
      dc.addEventListener('message', async (e) => {
        const event = JSON.parse(e.data);
        console.log('Received event:', event.type, event);
        
        switch (event.type) {
          case 'response.audio.delta':
            setIsSpeaking(true);
            setIsListening(false);
            break;
            
          case 'response.audio.done':
            setIsSpeaking(false);
            setIsListening(true);
            break;
            
          case 'input_audio_buffer.speech_started':
            setIsListening(true);
            setPartialTranscript('');
            break;
            
          case 'input_audio_buffer.speech_stopped':
            setIsListening(false);
            break;
            
          case 'conversation.item.input_audio_transcription.completed':
            if (event.transcript) {
              setMessages(prev => [...prev, {
                id: `user-${Date.now()}`,
                role: 'user',
                content: event.transcript,
                timestamp: new Date()
              }]);
              setPartialTranscript('');
            }
            break;
            
          case 'response.audio_transcript.delta':
            setPartialTranscript(prev => prev + (event.delta || ''));
            break;
            
          case 'response.audio_transcript.done':
            if (event.transcript) {
              setMessages(prev => [...prev, {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: event.transcript,
                timestamp: new Date()
              }]);
              setPartialTranscript('');
            }
            break;
            
          case 'response.function_call_arguments.done':
            if (event.name && event.arguments) {
              try {
                const args = JSON.parse(event.arguments);
                const result = await handleFunctionCall(event.name, args);
                
                // Send function result back
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: event.call_id,
                    output: JSON.stringify(result)
                  }
                }));
                dc.send(JSON.stringify({ type: 'response.create' }));
              } catch (err) {
                console.error('Function call parse error:', err);
              }
            }
            break;
            
          case 'error':
            console.error('OpenAI error:', event.error);
            toast({
              title: 'Voice Assistant Error',
              description: event.error?.message || 'An error occurred',
              variant: 'destructive'
            });
            break;
        }
      });
      
      // Create and set local description
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      // Connect to OpenAI's Realtime API
      const baseUrl = 'https://api.openai.com/v1/realtime';
      const model = 'gpt-4o-realtime-preview-2024-12-17';
      
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          'Content-Type': 'application/sdp'
        }
      });
      
      if (!sdpResponse.ok) {
        throw new Error('Failed to connect to OpenAI');
      }
      
      const answer = {
        type: 'answer' as RTCSdpType,
        sdp: await sdpResponse.text()
      };
      
      await pc.setRemoteDescription(answer);
      console.log('WebRTC connection established');
      
    } catch (error) {
      console.error('Error starting conversation:', error);
      setIsConnecting(false);
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to start voice assistant',
        variant: 'destructive'
      });
    }
  }, [handleFunctionCall, toast, session]);

  const endConversation = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    
    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
      audioElRef.current = null;
    }
    
    setIsConnected(false);
    setIsSpeaking(false);
    setIsListening(false);
    setPartialTranscript('');
  }, []);

  const toggleMute = useCallback(() => {
    if (mediaStreamRef.current) {
      const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted;
        setIsMuted(!isMuted);
      }
    }
  }, [isMuted]);

  useEffect(() => {
    return () => {
      endConversation();
    };
  }, [endConversation]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
              isConnected ? (isSpeaking ? "bg-primary animate-pulse" : "bg-green-500") : "bg-muted"
            )}>
              <MessageSquare className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">Voice Assistant</h3>
              <p className="text-xs text-muted-foreground">
                {isConnecting ? 'Connecting...' : isConnected ? (isSpeaking ? 'Speaking...' : isListening ? 'Listening...' : 'Connected') : 'Disconnected'}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Messages */}
        <div className="h-80 overflow-y-auto p-4 space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "max-w-[85%] p-3 rounded-2xl text-sm",
                message.role === 'user'
                  ? "ml-auto bg-primary text-primary-foreground rounded-br-md"
                  : "mr-auto bg-muted text-muted-foreground rounded-bl-md"
              )}
            >
              {message.content}
            </div>
          ))}
          
          {partialTranscript && (
            <div className="mr-auto max-w-[85%] p-3 rounded-2xl rounded-bl-md bg-muted text-muted-foreground text-sm opacity-70">
              {partialTranscript}
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-border bg-muted/30">
          {!isConnected ? (
            <Button
              onClick={startConversation}
              disabled={isConnecting}
              className="w-full gap-2"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  Start Voice Chat
                </>
              )}
            </Button>
          ) : (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={toggleMute}
                className={cn("rounded-full w-12 h-12", isMuted && "bg-destructive/20")}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>
              
              <Button
                variant="destructive"
                size="icon"
                onClick={() => {
                  endConversation();
                  onClose();
                }}
                className="rounded-full w-14 h-14"
              >
                <X className="w-6 h-6" />
              </Button>
              
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (audioElRef.current) {
                    audioElRef.current.muted = !audioElRef.current.muted;
                  }
                }}
                className="rounded-full w-12 h-12"
              >
                {audioElRef.current?.muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Button>
            </div>
          )}
          
          <p className="text-xs text-center text-muted-foreground mt-3">
            Supports English, Hindi & Hinglish
          </p>
        </div>
      </div>
    </div>
  );
}
