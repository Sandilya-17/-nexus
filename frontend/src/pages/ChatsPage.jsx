import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import useChatStore from '../context/chatStore';
import api from '../services/api';
import ChatList from '../components/chat/ChatList';
import ChatWindow from '../components/chat/ChatWindow';
import NoChatSelected from '../components/chat/NoChatSelected';
import { joinChat } from '../services/socket';

export default function ChatsPage() {
  const { chatId } = useParams();
  const { chats, setChats, activeChat, setActiveChat } = useChatStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const { data } = await api.get('/chats');
        setChats(data.chats);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchChats();
  }, []);

  useEffect(() => {
    if (chatId && chats.length > 0) {
      const chat = chats.find(c => c._id === chatId);
      if (chat) {
        setActiveChat(chat);
        joinChat(chatId);
      }
    }
    if (!chatId) setActiveChat(null);
  }, [chatId, chats]);

  return (
    <div className="flex h-full">
      {/* Chat list sidebar */}
      <div className={`
        w-full md:w-80 lg:w-96 flex-shrink-0
        border-r border-[var(--border)]
        ${activeChat ? 'hidden md:flex flex-col' : 'flex flex-col'}
      `}>
        <ChatList loading={loading} />
      </div>

      {/* Chat window */}
      <div className={`
        flex-1 flex flex-col
        ${!activeChat ? 'hidden md:flex' : 'flex'}
      `}>
        {activeChat ? <ChatWindow /> : <NoChatSelected />}
      </div>
    </div>
  );
}
