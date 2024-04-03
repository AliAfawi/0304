using BookShop.Data;
using BookShop.Models;
using BookStore.Data;
using DocumentFormat.OpenXml.InkML;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics;
using System.Threading.Tasks;

namespace BookShop.Controllers
{

    public class HomeController : Controller
    {
        private readonly ILogger<HomeController> _logger;
        private readonly BookStoreContext _context;
        private readonly Microsoft.AspNetCore.Identity.UserManager<User> _userManager;


        public HomeController(ILogger<HomeController> logger, BookStoreContext context, Microsoft.AspNetCore.Identity.UserManager<User> userManager)
        {
            _logger = logger;
            _context = context;
            _userManager = userManager;
        }

        public async Task<IActionResult> Index()
        {
            var books = await _context.Books.ToListAsync();
            return View(books);
        }

        public async Task<IActionResult> ShowBook()
        {
            var books = await _context.Books.ToListAsync();
            return View(books);
        }

        public IActionResult Privacy()
        {
            return View();
        }
       
        


        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }

        //public async Task<IActionResult> SearchBook(string searchString)
        //{
        //    var books = from m in _context.Books
        //                select m;

        //    if (!String.IsNullOrEmpty(searchString))
        //    {
        //        books = books.Where(s => s.Title.Contains(searchString)
        //                               || s.Author.Contains(searchString));
        //    }

        //    return View(await books.ToListAsync());
        //}

        //public async Task<IActionResult> ShowBook(string title)
        //{
        //    var book = await _context.Books.FirstOrDefaultAsync(b => b.Title == title);
        //    if (book == null)
        //    {
        //        return NotFound();
        //    }
        //    return View(book);
        //}

        public async Task<IActionResult> FilterByCategory(string category)
        {
            var books = from m in _context.Books
                        select m;

            if (!String.IsNullOrEmpty(category))
            {
                books = books.Where(s => s.ImgUrl.Contains( category ));
            }

            return View("Index", await books.ToListAsync()); // Assuming you want to reuse the Index view to display the filtered results
        }
        public async Task<IActionResult> SearchBook(string searchString)
        {
            var books = from m in _context.Books
                        select m;

            if (!String.IsNullOrEmpty(searchString))
            {
                books = books.Where(s => s.Title.Contains(searchString) || s.Author.Contains(searchString));
            }

            return View("Index", await books.ToListAsync()); // Assuming you want to reuse the Index view to display the search results
        }

        public async Task<IActionResult> PriceAscending()
        {
            var books = await _context.Books.OrderBy(b => b.Price).ToListAsync();
            return View("Index", books); // Assuming you want to reuse the Index view to display the sorted list
        }

        public async Task<IActionResult> PriceDescending()
        {
            var books = await _context.Books.OrderByDescending(b => b.Price).ToListAsync();
            return View("Index", books); // Reusing the Index view for display
        }



        //// Dummy method to retrieve book details
        private Book GetBookById(int id)
        {
            return _context.Books.FirstOrDefault(b => b.BookID == id);
        }


        [HttpGet]
        [Route("Home/ShowBook/{id}", Name = "ShowBookById")]
        public ActionResult ShowBook(int id)
        {
            var book = GetBookById(id);

            // Pass the book details to the view
            return View(book);
        }


 
        public IActionResult AddToCartBuy(int bookId)
        {
            var cart = CartManger.GetCart(HttpContext);
            CartManger.AddToCart(cart, bookId,1);

            return RedirectToAction("Cart", "ShoppingCart");
        }
        public IActionResult AddToCart(int bookId)
        {

            var cart = CartManger.GetCart(HttpContext);
            CartManger.AddToCart(cart, bookId, 1);
            return RedirectToAction("Index", "Home");
        }

    }


}
