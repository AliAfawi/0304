CREATE TABLE [dbo].[Books] (
    [BookID] INT PRIMARY KEY IDENTITY(1,1),
    [Title] NVARCHAR(255),
    [Author] NVARCHAR(255),
    [Price] DECIMAL(18, 2),
    [StockQuantity] INT,
    [ImgUrl] NVARCHAR(MAX),
    [Description] NVARCHAR(MAX)
);
