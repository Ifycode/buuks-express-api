import mongoose, { UpdateQuery } from 'mongoose';
import {
  NextFunction,
  Request,
  Response
} from 'express';
import {
  getBooksService,
  createBookService,
  getOneBookService,
  deleteBookService,
  getUserByIdService,
  updateBookservice
} from '../services/book.service';
import dotenv from 'dotenv';
import {
  CreateBookInput,
  DeleteBookInput,
  GetOneBookInput,
  UploadBookInput
} from '../../middleware/schema/book.schema';
import { dataUri } from '../../middleware/multer';
import { uploader } from '../../config/cloudinary';
import { BookDocument } from '../models/book.model';

dotenv.config();

let bookItem: string = 'book';
let routeName: string = `${bookItem}s`;

export const getBooksForEachUserController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.params.userId);
    const user = await getUserByIdService(userId);
    // console.log('user: ', user);
    const docs = await getBooksService({ user: userId });
    // console.log(docs);

    if (user === null || user === undefined) {
      return res.status(401).json({
        message: `Only the book\'s owner is authorized to perform this operation. One loggedin user is not permitted to update another user\'s book, supply the bookID for any of the books you created.`,
        error: 'Unauthorized'
      });
    }

    return res.status(200).json({
      count: docs.length,
      description: `List of books uploaded by user: ${user?.name}, user ID: ${user?._id}`,
      books: docs.map(doc => {
        return {
          _id: doc._id,
          title: doc.title,
          description: doc.description,
          pdf: doc.pdf,
          request: {
            type: 'GET',
            url: `${process.env.API_HOST_URL}/${routeName}/${doc._id}`,
            description: `Get this single ${bookItem} by ID at the above url`
          }
        }
      })
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Invalid user ID',
      error: `${err}`
    });
  }
}

export const createBookController = async (req: Request<CreateBookInput['body'], UploadBookInput['file']>, res: Response) => {
  try {
    const userName = res.locals.user.name;
    const userId = res.locals.user._id;

    // TODO: extract any cloudinary upload code to a separate service for reuse, and just call the service when needed
    // TODO: create and/or specify separate folder to upload PDF to on cloudinary (per user)
    if (req.file) {
      // console.log('file: ', req.file);
      const file = dataUri(req).content as string;
      // console.log(file)
      return uploader.upload(file).then(async (result) => {
        // console.log(result)
        const pdf = result.url;
        const body = { pdf, ...req.body };
        // console.log('body: ', body);
        //-----------------------------------------------------
        const doc = await createBookService({ ...body, user: userId });
        return res.status(201).json({
          message: `New ${bookItem} created successfully!`,
          user: {
            name: userName,
            _id: userId,
          },
          book: {
            _id: doc._id,
            title: doc.title,
            description: doc.description,
            pdf: doc.pdf,
            request: {
              type: 'GET',
              url: `${process.env.API_HOST_URL}/${routeName}/${doc._id}`,
              description: `Get this single ${bookItem} by ID at the above url`
            }
          }
        });
        //-----------------------------------------------------
      }).catch((err) => res.status(400).json({
        message: 'something went wrong while processing your request',
        data: {
          err
        }
      }));
    }
  } catch (err) {
    res.status(409).json({
      error: `${err}`
    });
  }
}

export const getOneBookController = async (req: Request<GetOneBookInput['params']>, res: Response, next: NextFunction) => {
  try {
    const bookId = new mongoose.Types.ObjectId(req.params.bookId);
    const doc = await getOneBookService(bookId);
    if (doc) {
      return res.status(200).json({
        _id: doc._id,
        title: doc.title,
        description: doc.description,
        pdf: doc.pdf,
        user: {
          _id: doc.user,
        },
        request: {
          type: 'GET',
          url: `${process.env.API_HOST_URL}/${routeName}`,
          description: `Get the list of all ${bookItem}s for this user at the above url`,
        }
      });
    } else {
      return res.status(404).json({
        message: 'No record found for provided ID'
      });
    }
  } catch (err) {
    return res.status(500).json({
      message: 'Invalid ID',
      error: `${err}`
    });
  }
}

export const updateBookController = async (req: Request, res: Response) => {
  try {
    const userName = res.locals.user.name;
    const userId = res.locals.user._id;
    const bookId = new mongoose.Types.ObjectId(req.params.bookId);
    const book = await getOneBookService(bookId);

    if (!book) {
      return res.status(404).json({
        message: 'No record found for provided ID'
      });
    }

    if (book.user.toString() !== userId) {
      return res.status(401).json({
        message: `Only the book\'s owner is authorized to perform this operation. One loggedin user is not permitted to update another user\'s book, supply the bookID for any of the books you created. Find your books with their bookIDs at: GET /books/user/${userId}`,
        error: 'Unauthorized'
      });
    }

    const updateBook = async (body: UpdateQuery<BookDocument>) => {
      const doc = await updateBookservice(bookId, body, { new: true });
      let dbvalues = [{ title: doc?.title, description: doc?.description }, { title: doc?.title }, { description: doc?.description }];
      let ifSame = dbvalues.some(value => JSON.stringify(Object.values(body)) === JSON.stringify(Object.values(value)));
      let sameTitle = book.title === body.title;
      let sameDescription = book.description === body.description;
      let message: string;
      if (Object.keys(body).length === 0 || (ifSame && sameTitle && sameDescription)) {
        message = 'No change made';
      } else {
        message = `${bookItem} updated successfully!`;
      }
      res.status(200).json({
        message: message,
        user: {
          name: userName,
          _id: userId,
        },
        book: {
          _id: doc?._id,
          title: doc?.title,
          description: doc?.description,
          pdf: doc?.pdf,
          request: {
            type: 'GET',
            url: `${process.env.API_HOST_URL}/${routeName}/${bookId.toString()}`,
            description: `Get this single ${bookItem} by ID at the above url`
          }
        }
      });
    }
    // TODO: Not only in DB. On Cloudinary, update should replace the previous PDF file attached to this book id
    if (req.file) {
      // console.log('file: ', req.file);
      const file = dataUri(req).content as string;
      // console.log(file)
      return uploader.upload(file).then(async (result) => {
        // console.log(result)
        const pdf = result.url;
        const body = { pdf, ...req.body };
        // console.log('body: ', body);
        //-----------------------------------------------------
        updateBook(body);
        //-----------------------------------------------------
      }).catch((err) => res.status(400).json({
        message: 'something went wrong while processing your request',
        data: {
          err
        }
      }));
    } else {
      //-----------------------------------------------------
      updateBook(req.body);
      //-----------------------------------------------------
    }
  } catch (err) {
    res.status(500).json({
      message: `Error updating ${bookItem}`,
      error: `${err}`
    });
  }
}

export const deleteBookController = async (req: Request<DeleteBookInput['params']>, res: Response, next: NextFunction) => {
  try {
    const userName = res.locals.user.name;
    const userId = res.locals.user._id;
    const bookId = new mongoose.Types.ObjectId(req.params.bookId);
    const book = await getOneBookService(bookId);

    if (!book) {
      return res.status(404).json({
        message: 'No record found for provided ID'
      });
    }

    if (book.user.toString() !== userId) {
      return res.status(401).json({
        message: `Only the book\'s owner is authorized to perform this operation. One loggedin user is not permitted to delete another user\'s book, supply the bookID for any of the books you created. Find your books with their bookIDs at: GET /books/user/${userId}`,
        error: 'Unauthorized'
      });
    }

    // TODO: Not only in DB. On Cloudinary, delete PDF file attached to this book id

    await deleteBookService(bookId);

    res.status(200).json({
      message: `${bookItem} deleted successfully!`,
      user: {
        name: userName,
        _id: userId,
      },
      request: {
        type: 'POST',
        url: `${process.env.API_HOST_URL}/${routeName}`,
        description: `Create a new ${bookItem} at the above url`
      }
    });
  } catch (err) {
    res.status(500).json({
      message: `Error deleting ${bookItem}`,
      error: `${err}`
    });
  }
}