import { useState, useEffect } from 'react';

import io from 'socket.io-client';
import CryptoJS from 'crypto-js'; 

import SendText from './sendText';
import DisplayText from './displayText';

const socket = io('https://chattuah-backend.onrender.com');
const secretKey = 'xrTcxoWDqztoar40ePgiBdzif1wuIADYbdeJ3QVIooneAHPNhpvo5XgHAK/zlv5j';

import Logo from '../canLogo/logo';


const encrypt = (text) => {
    return CryptoJS.AES.encrypt(text, secretKey).toString();
  };
  
  const decrypt = (text) => {
    const bytes = CryptoJS.AES.decrypt(text, secretKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }
  
  function Chat() {
    const [messages, setMessages] = useState([]);
  
    useEffect(() => {
      // Decrypt and set the messages when received
      const handleInitMessages = (messages) => {
        console.log('Received init messages:', messages);
        const decryptedMessages = messages.map((message) => ({
          ...message,
          text: decrypt(message.text),
        }));
        setMessages(decryptedMessages);
      };
  
      const handleChatMessage = (message) => {
        console.log('Received chat message:', message);
        const decryptedMessage = {
          ...message,
          text: decrypt(message.text),
        };
        setMessages((prevMessages) => [...prevMessages, decryptedMessage]);
      };
  
      socket.on('init', handleInitMessages);
      socket.on('chat message', handleChatMessage);
  
      return () => {
        socket.off('init', handleInitMessages);
        socket.off('chat message', handleChatMessage);
      };
    }, []);
  
    const sendMessage = (text) => {
      console.log('Sending message:', text);
      const encryptedText = encrypt(text);
      const decryptedText = decrypt(encryptedText);
  
      console.log('Decrypted text:', decryptedText);
      socket.emit('chat message', encryptedText);
    };
  
    return (
      <div className="app-container">
        <div className="logo-container">
          <Logo />
        </div>
        <div className="chat-container">
          <SendText sendMessage={sendMessage} /> 
          <DisplayText messages={messages} />
        </div>
      </div>
    );
  };

export default Chat;