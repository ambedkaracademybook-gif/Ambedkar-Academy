import {
  IMG_batch1,
  IMG_batch2,
  IMG_batch3,
  IMG_batch4,
  IMG_guest,
  IMG_mentor,
  IMG_cashPrize
} from "./assets/images";

export interface Testimonial {
  id: string;
  name: string;
  location: string;
  role: string;
  feedback: string;
  rating: number;
  image?: string;
}

export const testimonials: Testimonial[] = [
  {
    id: "t1",
    name: "Anbarasan K.",
    location: "Salem",
    role: "TNPSC Group 4 Aspirant",
    feedback: "Ambedkar Academy's free guidance seminar instilled absolute confidence in me. The specific methodologies shared to face the 2026 exam are outstanding!",
    rating: 5,
    image: IMG_batch1
  },
  {
    id: "t2",
    name: "Kavitha Selvam",
    location: "Madurai",
    role: "TNPSC Group 2 Aspirant",
    feedback: "This class gave me perfect clarity on how to break down the syllabus. The strategy to simplify Samacheer books was exceptionally helpful.",
    rating: 5,
    image: IMG_batch2
  },
  {
    id: "t3",
    name: "Mathiyalagan R.",
    location: "Trichy",
    role: "Repeat Aspirant (Group 2)",
    feedback: "The daily 30-minute practice formula has drastically boosted my speed and accuracy. The ₹1 Lakh worth free mock test is an amazing opportunity!",
    rating: 5,
    image: IMG_batch3
  },
  {
    id: "t4",
    name: "Priya Krishnan",
    location: "Chennai",
    role: "Group 1 Aspirant",
    feedback: "Direct mentoring and real-life success stories from government officials deeply inspired me. This is a must-attend workshop for every sincere aspirant.",
    rating: 5,
    image: IMG_batch4
  },
  {
    id: "t5",
    name: "Saravanan P.",
    location: "Coimbatore",
    role: "Beginner Aspirant",
    feedback: "They explained secrets on what to study and what to skip in school textbooks. I am now confident that I can clear the exam in my very first attempt.",
    rating: 5,
    image: IMG_guest
  },
  {
    id: "t6",
    name: "Divya Bharathi",
    location: "Tirunelveli",
    role: "Group 4 Aspirant",
    feedback: "Practicing daily mock questions through the Ambedkar Academy Mobile App is extremely easy. This free workshop is a true blessing!",
    rating: 5,
    image: IMG_mentor
  },
  {
    id: "t7",
    name: "Vijaykumar M.",
    location: "Vellore",
    role: "Group 2 & 4 Aspirant",
    feedback: "The simple shortcuts and memory tricks they shared for General Tamil and Aptitude are highly effective for securing top marks.",
    rating: 5,
    image: IMG_cashPrize
  },
  {
    id: "t8",
    name: "Subashini S.",
    location: "Erode",
    role: "Group 2 Aspirant",
    feedback: "Time management strategies and question paper analysis methods were super helpful. High-quality study booklets were also provided for free!",
    rating: 5,
    image: IMG_batch1
  },
  {
    id: "t9",
    name: "Karthikeyan D.",
    location: "Thanjavur",
    role: "Beginner Aspirant",
    feedback: "The 6th to 12th standard 'Where to Study' guide provided during this workshop saved me hundreds of hours of manual search.",
    rating: 5,
    image: IMG_batch2
  },
  {
    id: "t10",
    name: "Abinaya V.",
    location: "Dindigul",
    role: "Group 4 Aspirant",
    feedback: "All my fears and doubts regarding the TNPSC exam pattern are completely gone now. The individual mentoring approach is truly remarkable.",
    rating: 5,
    image: IMG_batch3
  },
  {
    id: "t11",
    name: "Rajesh Kumar",
    location: "Nagercoil",
    role: "Group 2 & 4 Aspirant",
    feedback: "This seminar is undoubtedly the ultimate roadmap for anyone preparing for the upcoming Group 4 exams. Highly recommended!",
    rating: 5,
    image: IMG_batch4
  },
  {
    id: "t12",
    name: "Meenakshi Sundaram",
    location: "Viluppuram",
    role: "Repeat Aspirant",
    feedback: "The positive energy, encouragement, and clear methodology of the educators is highly motivating. Thank you so much, Ambedkar Academy!",
    rating: 5,
    image: IMG_guest
  },
  {
    id: "t13",
    name: "Dinesh Karthi",
    location: "Cuddalore",
    role: "Group 4 Aspirant",
    feedback: "The 250-days challenge with 3000 questions has completely structured my daily routine. A phenomenal learning initiative!",
    rating: 5,
    image: IMG_mentor
  },
  {
    id: "t14",
    name: "Ramya Devi",
    location: "Kanchipuram",
    role: "Group 2 Aspirant",
    feedback: "I never expected to receive such high-quality guidance, interactive study planners, and tips completely for free. Extremely grateful!",
    rating: 5,
    image: IMG_cashPrize
  },
  {
    id: "t15",
    name: "Selva Ganapathy",
    location: "Pudukkottai",
    role: "Group 1 & 2 Aspirant",
    feedback: "Ambedkar Academy's mock exams are so authentic and well-crafted. Taking them feels exactly like sitting for the real TNPSC exam.",
    rating: 5,
    image: IMG_batch1
  },
  {
    id: "t16",
    name: "Karthiga Murugan",
    location: "Theni",
    role: "Group 4 Aspirant",
    feedback: "The shortcut methods for solving mental ability and aptitude questions in under 30 seconds are absolute game-changers for me.",
    rating: 5,
    image: IMG_batch2
  },
  {
    id: "t17",
    name: "Arun Pandian",
    location: "Sivakasi",
    role: "Group 2 Aspirant",
    feedback: "Highly systematic and result-oriented approach. They don't just teach the syllabus; they teach the exact mindset required to pass.",
    rating: 5,
    image: IMG_batch3
  },
  {
    id: "t18",
    name: "Sangeetha Krish",
    location: "Karur",
    role: "Beginner Aspirant",
    feedback: "As a housemaker, managing time was my biggest hurdle. The customized study planner provided here made my preparation journey seamless.",
    rating: 5,
    image: IMG_batch4
  },
  {
    id: "t19",
    name: "Manoj Kumar",
    location: "Tiruppur",
    role: "Group 4 Aspirant",
    feedback: "The free offline classroom experience during the seminar was exceptional. Excellent environment, helpful mentors, and clear guidance.",
    rating: 5,
    image: IMG_guest
  },
  {
    id: "t20",
    name: "Bhuvaneshwari R.",
    location: "Dharmapuri",
    role: "Group 2 & 4 Aspirant",
    feedback: "I drove all the way from my town to attend, and it was worth every minute! The materials given are highly valuable for revision.",
    rating: 5,
    image: IMG_mentor
  }
];
