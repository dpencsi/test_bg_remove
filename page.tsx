'use client'
import React, { useState, useEffect, useRef } from 'react';

interface WorkerMessageEvent {
    data: {
        status: string;
        output?: string;
        percentage?: number;
        index?: number;
        error?: string;
    };
}

const Home = () => {
    const worker = useRef<Worker | null>(null);
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [completedImages, setCompletedImages] = useState<string[]>([]);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {

        if (!worker.current) {
            worker.current = new Worker(new URL('./worker.ts', import.meta.url), {
                type: 'module'
            });
        }

        const onMessageReceived = (event: MessageEvent<WorkerMessageEvent>) => {
            if (!event.data) return; // Ensure there's valid data
            const { status, output, index, error } = event.data;

            if (status === 'model-loaded') {
                console.log('Model loaded successfully.');
            } else if (status === 'complete') {
                setCompletedImages(prev => {
                    const newCompletedImages = [...prev];
                    newCompletedImages[index] = output;
                    return newCompletedImages;
                });
            } else if (status === 'error') {
                console.error(`Error processing image ${index}: ${error}`);
            }

            if (index === imageFiles.length - 1) {
                setProcessing(false);
                worker.current?.terminate();
            }
        };

        worker.current.onerror = (error) => {
            console.error('Worker error:', error)
        }

        worker.current.addEventListener('message', onMessageReceived);
        return () => {
            worker.current?.removeEventListener('message', onMessageReceived);
        };
    }, []);

    const handleEraseBackground = () => {
        if (processing || imageFiles.length === 0 || !worker) return;
        console.log('Start erase background');

        setProcessing(true);
        setCompletedImages([]);

        if (worker.current) {
            worker.current.postMessage({ imageFiles: imageFiles });

        }
    };

    const handleRemoveImage = (img: File) => {
        setImageFiles(oldImages => {
            return oldImages.filter(image => image !== img)
        })
    };

    return (
        <div className="p-4 py-10 max-w-3xl mx-auto text-center shadow-2xl rounded-2xl relative">
            <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setImageFiles(Array.from(e.target.files || []))}
            />
            <div className="my-10">
                <button
                    className="px-12 py-4 bg-blue-600 text-white text-xl font-bold rounded-full hover:bg-blue-800 transition duration-300"
                    onClick={handleEraseBackground}
                    disabled={processing}
                >
                    {processing ? 'Processing...' : 'Erase Background'}
                </button>
            </div>

            <div className='flex items-center justify-around flex-wrap gap-x-2 gap-y-12'>
                {imageFiles.map((image, index) => (
                    <div
                        key={`original_image_${index}`}
                        className='bg-white flex items-center justify-center relative'
                    >
                        <img className='w-32 bg-white bg-[length:25px]' width="128" src={URL.createObjectURL(image)} alt="" />
                        <svg
                            className="absolute rounded-full cursor-pointer transform transition duration-500 hover:rotate-180 -top-3 -right-3 w-6 h-6 text-white bg-red-600"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="1.5"
                            stroke="currentColor"
                            onClick={() => handleRemoveImage(image)}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12">
                            </path>
                        </svg>
                    </div>
                ))}
            </div>

            {completedImages.length > 0 && (
                <div className="p-4 mt-10 bg-white shadow-md rounded-lg">
                    <h2 className="text-xl font-bold mb-4">Completed Images</h2>
                    <div className="grid grid-cols-3 gap-4">
                        {completedImages.map((src, index) => (
                            <img key={`completed_image_${index}`} src={src} alt={`Processed Image ${index + 1}`} className="w-full h-auto" />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Home;