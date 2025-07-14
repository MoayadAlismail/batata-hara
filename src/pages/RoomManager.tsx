import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, LogIn, Wifi, WifiOff, User, Monitor } from 'lucide-react';
import { useSocket } from '@/contexts/SocketContext';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const RoomManager = () => {
  const { gameState, createRoom, joinRoom } = useSocket();
  const [joinPin, setJoinPin] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال اسم اللاعب",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await createRoom();
      if (result.success && result.pin) {
        // Join the room as host
        const joinResult = await joinRoom(result.pin, playerName);
        if (joinResult.success) {
          toast({
            title: "تم إنشاء الغرفة!",
            description: `رقم الغرفة: ${result.pin}`,
          });
          navigate('/game');
        } else {
          toast({
            title: "خطأ",
            description: joinResult.error || "فشل في الانضمام للغرفة",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "خطأ",
          description: result.error || "فشل في إنشاء الغرفة",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إنشاء الغرفة",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  const handleJoinRoom = async () => {
    if (!joinPin.trim() || !playerName.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال رقم الغرفة واسم اللاعب",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await joinRoom(joinPin, playerName);
      if (result.success) {
        toast({
          title: "تم الانضمام للغرفة!",
          description: `مرحباً ${playerName}`,
        });
        navigate('/game');
      } else {
        toast({
          title: "خطأ",
          description: result.error || "فشل في الانضمام للغرفة",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء الانضمام للغرفة",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-800 flex items-center justify-center p-4 font-handjet">
      <Card className="w-full max-w-md bg-gray-900/90 backdrop-blur-lg border-fallguys-purple/30 border-4 rounded-3xl">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl font-black text-white flex items-center justify-center gap-3 drop-shadow-lg">
            <Users className="text-fallguys-orange animate-bounce" size={48} />
            بطاطا حارة
          </CardTitle>
          <div className="flex items-center justify-center gap-2 mt-2">
            {gameState.connected ? (
              <>
                <Wifi className="text-fallguys-green" size={16} />
                <Badge variant="secondary" className="bg-fallguys-green/20 text-fallguys-green border-fallguys-green/50">
                  متصل
                </Badge>
              </>
            ) : (
              <>
                <WifiOff className="text-fallguys-red" size={16} />
                <Badge variant="secondary" className="bg-fallguys-red/20 text-fallguys-red border-fallguys-red/50">
                  غير متصل
                </Badge>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="single" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-gray-800/50 border-fallguys-purple/30 border-2 rounded-xl">
              <TabsTrigger 
                value="single" 
                className="text-white data-[state=active]:bg-fallguys-purple data-[state=active]:text-white font-bold"
              >
                <User className="ml-2 h-4 w-4" />
                لاعب واحد
              </TabsTrigger>
              <TabsTrigger 
                value="join" 
                className="text-white data-[state=active]:bg-fallguys-blue data-[state=active]:text-white font-bold"
              >
                <LogIn className="ml-2 h-4 w-4" />
                انضم
              </TabsTrigger>
              <TabsTrigger 
                value="create" 
                className="text-white data-[state=active]:bg-fallguys-green data-[state=active]:text-white font-bold"
              >
                <Plus className="ml-2 h-4 w-4" />
                إنشاء
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="single" className="space-y-4 mt-6">
              <div className="text-center space-y-4">
                <p className="text-white/90 text-lg">
                  العب لوحدك على نفس الجهاز
                </p>
                <Button 
                  onClick={() => navigate('/single-player')}
                  className="w-full bg-fallguys-purple hover:bg-fallguys-purple/80 text-white font-black text-xl py-6 rounded-xl border-4 border-white/30"
                >
                  <User className="ml-3 h-6 w-6" />
                  ابدأ اللعب الفردي
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="join" className="space-y-4 mt-6">
              <div className="space-y-3">
                <Input
                  placeholder="اسم اللاعب"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="bg-gray-800/80 border-fallguys-blue/50 border-2 text-white placeholder:text-white/70 text-lg font-bold rounded-xl"
                />
                <Input
                  placeholder="رقم الغرفة (6 أرقام)"
                  value={joinPin}
                  onChange={(e) => setJoinPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="bg-gray-800/80 border-fallguys-blue/50 border-2 text-white placeholder:text-white/70 text-lg font-bold rounded-xl text-center tracking-wider"
                />
              </div>
              <Button 
                onClick={handleJoinRoom}
                disabled={isLoading || !gameState.connected || !joinPin.trim() || !playerName.trim()}
                className="w-full bg-fallguys-blue hover:bg-fallguys-blue/80 text-white font-black text-xl py-6 rounded-xl border-4 border-white/30"
              >
                {isLoading ? 'جاري الانضمام...' : 'انضم للغرفة'}
              </Button>
            </TabsContent>
            
            <TabsContent value="create" className="space-y-4 mt-6">
              <div className="space-y-3">
                <Input
                  placeholder="اسم اللاعب (المضيف)"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="bg-gray-800/80 border-fallguys-green/50 border-2 text-white placeholder:text-white/70 text-lg font-bold rounded-xl"
                />
              </div>
              <Button 
                onClick={handleCreateRoom}
                disabled={isLoading || !gameState.connected || !playerName.trim()}
                className="w-full bg-fallguys-green hover:bg-fallguys-green/80 text-white font-black text-xl py-6 rounded-xl border-4 border-white/30"
              >
                {isLoading ? 'جاري إنشاء الغرفة...' : 'إنشاء غرفة جديدة'}
              </Button>
            </TabsContent>
          </Tabs>
          
          <div className="mt-6 text-center text-white/80 text-sm">
            <p className="mb-2">لعبة الكلمات العربية الممتعة</p>
            <p>ابحث عن الكلمات التي تحتوي على الحروف المطلوبة</p>
            <p className="mt-2">
              <Monitor className="inline h-4 w-4 ml-1" />
              لاعب واحد: العب على نفس الجهاز
            </p>
            <p>
              <Users className="inline h-4 w-4 ml-1" />
              متعدد اللاعبين: العب مع الأصدقاء عبر الإنترنت
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RoomManager; 