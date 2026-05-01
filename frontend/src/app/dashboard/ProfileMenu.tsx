"use client";

import { useState, useEffect } from "react";

export default function ProfileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  
  const [profilePic, setProfilePic] = useState(
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAegbAJ2PnOcflbgSQ459A6dOFs424Wdg5RQP58XlREoXSA1mByO-wekNdsxmByzZGB5GVaNUiqD9b0P5Da-BgOqi25KGo6faOOZ1XJ0GxEGO_OH9tSantjDo_HEDzqschFfr7_uCEpG7jt8LFR8WfvMrZMzB4ldTzaARd8BZkzn6P9k-LO5KTjkHblcEqa-nbZ1VwwEsFL4EWAi4I8IlPNY2zGtisDQ_hPzpNzBgKwa7X4QyIGiT1rPeJ2QBTlqvVkMVcZ5HS8Y1ix"
  );

  // Cleanup object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (profilePic.startsWith("blob:")) {
        URL.revokeObjectURL(profilePic);
      }
    };
  }, [profilePic]);

  // Mock initial data
  const [formData, setFormData] = useState({
    firstName: "Aarav",
    lastName: "Sharma",
    email: "aarav@clubhub.com",
    dob: "2002-05-14",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // Save logic would go here
    setIsOpen(false);
  };

  return (
    <>
      <div 
        className="flex items-center gap-3 font-ui text-16 cursor-pointer hover:text-link-blue transition-150"
        onClick={() => setIsOpen(true)}
      >
        <span className="font-bold uppercase tracking-wide">Aarav (President)</span>
        <div className="w-10 h-10 border-2 border-black overflow-hidden bg-hairline-tint hover:border-link-blue transition-150">
          <img 
            alt="Aarav" 
            className="w-full h-full object-cover grayscale" 
            src={profilePic}
          />
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink bg-opacity-50 p-4">
          <div className="bg-white border-2 border-black w-full max-w-form p-6 md:p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6 border-b-2 border-black pb-4">
              <div>
                <div className="font-mono text-12 font-bold tracking-widest text-black mb-2 uppercase">
                  User Settings
                </div>
                <h2 className="font-display text-36 font-normal uppercase text-black m-0 leading-none">
                  Edit Profile
                </h2>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="w-10 h-10 border-2 border-black flex items-center justify-center hover:bg-black hover:text-white transition-150 rounded-none bg-white text-black"
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              <div className="flex items-center gap-6 pb-6 border-b-2 border-black">
                <div className="w-20 h-20 border-2 border-black overflow-hidden bg-hairline-tint shrink-0">
                  <img 
                    alt="Current Profile" 
                    className="w-full h-full object-cover grayscale" 
                    src={profilePic}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-ui text-16 font-bold text-black uppercase">
                    Profile Picture
                  </label>
                  <label className="cursor-pointer inline-flex items-center justify-center bg-white text-black border-2 border-black px-4 py-2 font-ui text-14 hover:bg-black hover:text-white transition-150 uppercase font-bold w-fit">
                    Upload Image
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          const imageUrl = URL.createObjectURL(file);
                          setProfilePic(imageUrl);
                        }
                      }} 
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 flex flex-col gap-2">
                  <label className="font-ui text-16 font-bold text-black uppercase" htmlFor="firstName">
                    First Name
                  </label>
                  <input
                    className="border-2 border-black bg-white text-black p-3 font-ui text-16 focus:outline-none focus:ring-0 focus:border-black rounded-none"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="Enter first name"
                    type="text"
                    required
                  />
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  <label className="font-ui text-16 font-bold text-black uppercase" htmlFor="lastName">
                    Last Name
                  </label>
                  <input
                    className="border-2 border-black bg-white text-black p-3 font-ui text-16 focus:outline-none focus:ring-0 focus:border-black rounded-none"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Enter last name"
                    type="text"
                    required
                  />
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <label className="font-ui text-16 font-bold text-black uppercase" htmlFor="email">
                  Email
                </label>
                <input
                  className="border-2 border-black bg-white text-black p-3 font-ui text-16 focus:outline-none focus:ring-0 focus:border-black rounded-none"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter email address"
                  type="email"
                  required
                />
              </div>
              
              <div className="flex flex-col gap-2">
                <label className="font-ui text-16 font-bold text-black uppercase" htmlFor="dob">
                  Date of Birth
                </label>
                <input
                  className="border-2 border-black bg-white text-black p-3 w-full font-ui text-16 focus:outline-none focus:ring-0 focus:border-black rounded-none pr-12"
                  id="dob"
                  name="dob"
                  value={formData.dob}
                  onChange={handleChange}
                  type="date"
                  required
                />
              </div>
              
              <div className="flex flex-col gap-2">
                <label className="font-ui text-16 font-bold text-black uppercase" htmlFor="password">
                  New Password (Optional)
                </label>
                <input
                  className="border-2 border-black bg-white text-black p-3 font-ui text-16 focus:outline-none focus:ring-0 focus:border-black rounded-none"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter new password to update"
                  type="password"
                />
              </div>

              <div className="pt-6 border-t-2 border-black mt-8 flex gap-4">
                <button
                  type="submit"
                  className="flex-1 bg-white border-2 border-black text-black font-ui text-16 font-bold p-4 uppercase hover:bg-black hover:text-white transition-150 rounded-none text-center"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 bg-white border-2 border-black text-black font-ui text-16 font-bold p-4 uppercase hover:bg-hairline-tint transition-150 rounded-none text-center"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
