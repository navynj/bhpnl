'use client';

import { Button } from '@/components/ui/Button';
import { signIn } from 'next-auth/react';
import Image from 'next/image';
import google from '@/public/logo/google.svg';

const Page = () => {
  const googleAuthHandler = async () => {
    await signIn('google', { callbackUrl: '/' });
  };

  return (
    <div className="flex flex-col gap-2 justify-center items-center h-[100dvh]">
      <h1 className="text-5xl font-extrabold">BH P&L</h1>
      {/* <div className="flex justify-center items-center bg-gray-100 rounded-full w-[300px] h-[300px]">
      </div> */}
      <form action={googleAuthHandler} className="mt-8">
        <Button
          type="submit"
          variant="outline"
          className="flex items-center space-x-2 py-6 px-10 pl-[1.5rem] text-lg font-semibold hover:bg-transparent hover:scale-101"
        >
          <Image src={google} alt="Google logo" width={40} height={40} />
          <p>Sign in with Google</p>
        </Button>
      </form>
    </div>
  );
};

export default Page;
